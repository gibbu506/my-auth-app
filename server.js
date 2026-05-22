
const fetch = require("node-fetch");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// Block static from serving index.html automatically
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/products.html") return next();
  express.static(__dirname)(req, res, next);
});
app.use(express.static(__dirname));

/* DATABASE CONNECTION */
mongoose.connect(process.env.MONGO_URI)

  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


/* USER MODEL */
const User = mongoose.model("User", {
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email:    { type: String },
  phone:    { type: String },
  role:     { type: String, default: "user" }
});

/* REGISTER ROUTE */
app.post("/register", async (req, res) => {
  const existing = await User.findOne({ username: req.body.username });
  if (existing) {
    return res.status(400).json({ message: "Username already taken" });
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const user = new User({
    username: req.body.username,
    password: hashedPassword,
    email:    req.body.email,
    phone:    req.body.phone
  });

  await user.save();
  res.json({ message: "User registered" });
});

/* LOGIN ROUTE */
app.post("/login", async (req, res) => {

  const user = await User.findOne({
    username: req.body.username
  });

  if (!user) {
    return res.status(400).json({
      message: "User not found"
    });
  }

  const validPassword = await bcrypt.compare(
    req.body.password,
    user.password
  );

  if (!validPassword) {
    return res.status(400).json({
      message: "Wrong password"
    });
  }

  const token = jwt.sign(
  { id: user._id,role: user.role }, 
   process.env.JWT_SECRET,
   { expiresIn: "1d" }

);

   res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({
    message: "Login successful",
    token: token
  });
});

/* HOME ROUTE */
// Remove the "/" route entirely, keep this:
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function verifyToken(req, res, next) {

  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "Access denied"
    });
  }

  try {

    const verified = jwt.verify(token,process.env.JWT_SECRET
);

    req.user = verified;

    next();

  } catch (err) {

    res.status(400).json({
      message: "Invalid token"
    });

  }
}

app.get("/dashboard", verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ message: "Welcome!", user });
});


/* PRODUCT MODEL */
const Product = mongoose.model("Product", {
  name:        { type: String, required: true },
  description: { type: String },
  price:       { type: Number, required: true },
  image:       { type: String }, // URL to image
  createdAt:   { type: Date, default: Date.now }
});

/* GET ALL PRODUCTS — public */
app.get("/products", async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

/* ADD PRODUCT — protected (must be logged in) */
app.post("/products", verifyToken, async (req, res) => {
  const product = new Product({
    name:        req.body.name,
    description: req.body.description,
    price:       req.body.price,
    image:       req.body.image
  });
  await product.save();
  res.json({ message: "Product added", product });
});

/* DELETE PRODUCT — protected */
app.delete("/products/:id", verifyToken, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted" });
});


/* MPESA - GET ACCESS TOKEN */
async function getMpesaToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );

  const data = await res.json();
   console.log("MPESA TOKEN RESPONSE:", data);
  return data.access_token;
}

/* MPESA - STK PUSH ROUTE */
app.post("/mpesa/pay", verifyToken, async (req, res) => {
  const { phone, amount, productName } = req.body;

  try {
    const token     = await getMpesaToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
    const password  = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: process.env.MPESA_SHORTCODE,
          Password:          password,
          Timestamp:         timestamp,
          TransactionType:   "CustomerPayBillOnline",
          Amount:            amount,
          PartyA:            phone,       // customer phone e.g 2547XXXXXXXX
          PartyB:            process.env.MPESA_SHORTCODE,
          PhoneNumber:       phone,
          CallBackURL:       process.env.MPESA_CALLBACK_URL,
          AccountReference:  productName,
          TransactionDesc:   `Payment for ${productName}`
        })
      }
    );

    const stkData = await stkRes.json();
    console.log("STK RESPONSE:", stkData);
    res.json(stkData);

  } catch (err) {
    res.status(500).json({ message: "STK push failed", error: err.message });
  }
});

/* MPESA - CALLBACK (Safaricom sends payment result here) */
app.post("/mpesa/callback", (req, res) => {
  const body = req.body.Body?.stkCallback;

  if (body?.ResultCode === 0) {
    // Payment successful
    const amount = body.CallbackMetadata.Item.find(i => i.Name === "Amount")?.Value;
    const phone  = body.CallbackMetadata.Item.find(i => i.Name === "PhoneNumber")?.Value;
    const receipt = body.CallbackMetadata.Item.find(i => i.Name === "MpesaReceiptNumber")?.Value;

    console.log(`✅ Payment received: KES ${amount} from ${phone} — Receipt: ${receipt}`);
    // TODO: update your database here
  } else {
    console.log("❌ Payment failed:", body?.ResultDesc);
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
}

  // ... rest of code
