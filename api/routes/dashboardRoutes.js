// api/routes/dashboardRoutes.js (VERSI STOK HITUNGAN SEDERHANA)
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Product = require('../models/Product');
const Information = require('../models/Information');
const mongoose = require('mongoose');

// --- USER ENDPOINTS (PROTECTED) ---

// @route   GET /api/data/dashboard-data
router.get('/dashboard-data', protect, async (req, res) => {
  
  // =========================================================================
  // BARIS INI HANYA UNTUK MEMAKSA CACHE VERCEL DI-RESET (HAPUS SETELAH BERHASIL)
  const clearCache = Date.now(); 
  // =========================================================================

  try {
    const user = await User.findById(req.user._id).select('-password'); 
    
    // Ambil semua produk yang memiliki stok hitungan > 0
    const products = await Product.find({ stock: { $gt: 0 } }).select('-createdAt -__v'); 
    
    // Ambil informasi terbaru
    const info = await Information.find({}).sort({ createdAt: -1 }).select('-__v');

    if (user) {
      res.json({
        username: user.username,
        saldo: user.saldo,
        transaksi: user.transaksi,
        products,
        information: info
      });
    } else {
      res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/data/purchase (LOGIKA PEMBELIAN SEDERHANA)
router.post('/purchase', protect, async (req, res) => {
    const { productId, quantity } = req.body;
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const product = await Product.findById(productId).session(session);
        const user = await User.findById(req.user._id).session(session);

        if (!product) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }
        
        const totalCost = product.price * quantity;

        // 1. Validasi Stok (Hitungan) dan Saldo
        if (product.stock < quantity) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Stok produk tidak mencukupi.' });
        }
        if (user.saldo < totalCost) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Saldo tidak mencukupi untuk transaksi ini.' });
        }
        
        // 2. Eksekusi Transaksi (MENGURANGI SALDO DAN STOK HITUNGAN SAJA)
        user.saldo -= totalCost;
        user.transaksi += 1;
        product.stock -= quantity; 

        await user.save({ session });
        await product.save({ session });

        await session.commitTransaction();

        res.json({ 
            message: `Pembelian sukses! ${quantity} unit ${product.name} dikurangi dari stok hitungan.`, 
            purchaseDetails: {
                productName: product.name,
                totalAmount: totalCost
            }
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: 'Server error saat memproses pembelian.' });
    } finally {
        session.endSession();
    }
});


// --- ADMIN ENDPOINTS (PROTECTED & ADMIN ROLE) ---

// @route   GET /api/data/admin/users
router.get('/admin/users', protect, admin, async (req, res) => {
    const users = await User.find({}).select('-password');
    res.json(users);
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


// @route   POST /api/data/admin/products
router.post('/admin/products', protect, admin, async (req, res) => {
    const { name, price, description, imageURL, stock } = req.body;
    try {
        // Menerima STOK awal langsung dari form Admin
        const product = await Product.create({ name, price, description, imageURL, stock: stock || 0 }); 
        res.status(201).json({ message: 'Produk berhasil ditambahkan! Stok awal diatur.', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/data/admin/products/:id
router.delete('/admin/products/:id', protect, admin, async (req, res) => {
    try {
        const result = await Product.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        res.json({ message: 'Produk berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// @route   POST /api/data/admin/info
router.post('/admin/info', protect, admin, async (req, res) => {
    const { title, content } = req.body;
    try {
        const info = await Information.create({ title, content, author: req.user._id });
        res.status(201).json({ message: 'Informasi berhasil diposting!', info });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
