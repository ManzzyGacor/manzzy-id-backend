const express = require('express');
const router = express.Router();
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: 'Username sudah terdaftar' });

    // Membuat akun Admin default jika ini akun pertama dan username-nya 'adminmanzzy'
    const userCount = await User.countDocuments();
    const isAdmin = username === 'adminmanzzy' && userCount === 0; 
    
    const user = await User.create({ username, password, isAdmin });

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        isAdmin: user.isAdmin,
        saldo: user.saldo,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username }).select('+password'); 

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      username: user.username,
      isAdmin: user.isAdmin,
      saldo: user.saldo,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'Username atau Password salah' });
  }
});

module.exports = router;
