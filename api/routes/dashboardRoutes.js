const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');

// --- USER DASHBOARD (PROTECTED) ---
// @route   GET /api/data/user-dashboard
router.get('/user-dashboard', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password'); 
    if (user) {
      res.json({
        username: user.username,
        saldo: user.saldo,
        transaksi: user.transaksi,
      });
    } else {
      res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ADMIN ENDPOINTS (PROTECTED & ADMIN ROLE) ---
// @route   GET /api/data/admin/users
router.get('/admin/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/data/admin/add-saldo
router.post('/admin/add-saldo', protect, admin, async (req, res) => {
  const { username, amount } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: 'Jumlah saldo tidak valid.' });
    }

    user.saldo += numericAmount;
    user.transaksi += 1; 
    await user.save();
    
    res.json({ message: `Saldo ${username} berhasil ditambah. Saldo baru: ${user.saldo}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
