require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* DATABASE CONNECTION */
mongoose.connect(process.env.MONGO_URI)

  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

/* USER MODEL */
const User = mongoose.model("User", {
  username: String,
  password: String
});

/* REGISTER ROUTE */
app.post("/register", async (req, res) => {

  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const user = new User({
    username: req.body.username,
    password: hashedPassword
  });

  await user.save();

  res.json({
    message: "User registered"
  });
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
  { id: user._id },
   process.env.JWT_SECRET,
   { expiresIn: "1d" }

);

res.json({
  message: "Login successful",
  token: token
});
});

/* HOME ROUTE */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function verifyToken(req, res, next) {

  const token = req.headers.authorization?.split(" ")[1];

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

app.get("/dashboard", verifyToken, (req, res) => {

  res.json({
    message: "Welcome to your dashboard 🔥",
    user: req.user
  });

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

