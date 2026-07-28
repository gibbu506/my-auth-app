const fetch = require("node-fetch");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);

/* MIDDLEWARE */
app.use(cookieParser());
app.use(cors({origin: true, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false
}));
 
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-hashes' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://*.tawk.to https://cdn.tawk.to",
      "script-src-attr 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to",
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.tawk.to",
      "font-src 'self' https://fonts.gstatic.com https://*.tawk.to",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.tawk.to",
      "frame-src https://www.youtube.com https://*.tawk.to https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
      "connect-src 'self' https://*.tawk.to wss://*.tawk.to https://fonts.googleapis.com https://fonts.gstatic.com",
      "worker-src 'self' blob:"
    ].join("; ")
  );
  next();
});

/* DATABASE CONNECTION */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

/* CLOUDINARY CONFIG */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* MULTER STORAGE */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation:  [{ width: 800, height: 800, crop: "limit", quality: "auto" }]
  }
});

const upload = multer({ storage });

/* USER MODEL */
const User = mongoose.model("User", {
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email:    { type: String },
  phone:    { type: String },
  role:     { type: String, default: "user" }
});

/* PRODUCT MODEL */
const Product = mongoose.model("Product", {
  name:        { type: String, required: true },
  description: { type: String },
  price:       { type: Number, required: true },
  image:       { type: String },
  video:       { type: String },
  category:    { type: String, default: "General" },
  createdAt:   { type: Date, default: Date.now }
});

/* VERIFY TOKEN */
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;
  if (!token) return res.status(401).json({ message: "Access denied" });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
}

/* VERIFY ADMIN */
function verifyAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
}

/* RATE LIMITERS */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, slow down." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many attempts, try again later." }
});

app.use(generalLimiter);

/* ─── ROUTES ─── */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "products.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

/* REGISTER */
app.post("/register", authLimiter, async (req, res) => {
  try {
    const existing = await User.findOne({ username: req.body.username });
    if (existing) return res.status(400).json({ message: "Username already taken" });

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      password: hashedPassword,
      email:    req.body.email,
      phone:    req.body.phone
    });

    await user.save();
    res.json({ message: "User registered" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* LOGIN */
const DUMMY_HASH = bcrypt.hashSync("dummy_password_for_timing", 10);

app.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Invalid input" });
    }

    const user = await User.findOne({ username });

    const hashToCompare = user ? user.password : DUMMY_HASH;
    const validPassword = await bcrypt.compare(password, hashToCompare);

    if (!user || !validPassword) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ message: "Login successful", token });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* DASHBOARD */
app.get("/dashboard", verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ message: "Welcome!", user });
});

/* PRODUCTS — public */
app.get("/products", async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

/* ADD PRODUCT — admin only */
app.post("/products", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const product = new Product({
      name:        req.body.name,
      description: req.body.description,
      price:       req.body.price,
      image:       req.body.image,
      video:       req.body.video,
      category:    req.body.category || "General"
    });
    await product.save();
    res.json({ message: "Product added", product });
  } catch (err) {
    res.status(500).json({ message: "Failed to add product" });
  }
});

/* DELETE PRODUCT — admin only */
app.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Product deleted" });
});

/* UPLOAD IMAGE — admin only */
app.post("/upload", verifyToken, verifyAdmin, upload.single("image"), (req, res) => {
  console.log("Upload req.file:", JSON.stringify(req.file));
  if (!req.file) {
    return res.status(400).json({ message: "No file received" });
  }
  res.json({ url: req.file.path });
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
  console.log("MPESA TOKEN RESPONSE:", JSON.stringify(data));
  return data.access_token;
}

/* MPESA - STK PUSH */
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
          PartyA:            phone,
          PartyB:            process.env.MPESA_SHORTCODE,
          PhoneNumber:       phone,
          CallBackURL:       process.env.MPESA_CALLBACK_URL,
          AccountReference:  productName,
          TransactionDesc:   `Payment for ${productName}`
        })
      }
    );

    const stkData = await stkRes.json();
    console.log("STK RESPONSE:", JSON.stringify(stkData));
    res.json(stkData);

  } catch (err) {
    res.status(500).json({ message: "STK push failed", error: err.message });
  }
});

/* MPESA - CALLBACK */
app.post("/mpesa/callback", (req, res) => {
  const body = req.body.Body?.stkCallback;

  if (body?.ResultCode === 0) {
    const amount  = body.CallbackMetadata.Item.find(i => i.Name === "Amount")?.Value;
    const phone   = body.CallbackMetadata.Item.find(i => i.Name === "PhoneNumber")?.Value;
    const receipt = body.CallbackMetadata.Item.find(i => i.Name === "MpesaReceiptNumber")?.Value;
    console.log(`Payment received: KES ${amount} from ${phone} — Receipt: ${receipt}`);
  } else {
    console.log("Payment failed:", body?.ResultDesc);
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

/* STATIC FILES — must be last */
app.use(express.static(__dirname));

/* START SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
