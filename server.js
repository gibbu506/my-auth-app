const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* DATABASE CONNECTION */
mongoose.connect("mongodb://127.0.0.1:27017/myapi")
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
    "SECRETKEY"
  );

  res.json({
    message: "Login successful",
    token: token
  });
});

/* HOME ROUTE */
app.get("/", (req, res) => {
  res.send("Auth server running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

function verifyToken(req, res, next) {

  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      message: "Access denied"
    });
  }

  try {

    const verified = jwt.verify(token, "SECRETKEY");

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