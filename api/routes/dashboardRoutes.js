// api/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Product = require('../models/Product');
const Information = require('../models/Information');
const Invoice = require('../models/Invoice');
const StockItem = require('../models/StockItem');
const mongoose = require('mongoose');

// --- USER ENDPOINTS (PROTECTED) ---

// @route   GET /api/data/dashboard-data
router.get('/dashboard-data', protect, async (req, res) => {
  
  // =========================================================================
  // BARIS INI HANYA UNTUK MEMAKSA CACHE VERCEL DI-RESET (HAPUS SETELAH PRODUK MUNCUL)
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

// @route   POST /api/data/purchase
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
            return res.status(400).json({ message: 'Stok hitungan produk tidak mencukupi.' });
        }
        if (user.saldo < totalCost) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Saldo tidak mencukupi untuk transaksi ini.' });
        }

        // 2. Ambil Item Stok Unik (CARI item yang belum terjual)
        const stockItems = await StockItem.find({ 
            product: productId, 
            isSold: false 
        }).limit(quantity).session(session);

        if (stockItems.length < quantity) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Stok fisik (kode unik) tidak mencukupi. Hubungi Admin.' });
        }
        
        // 3. Update Status Item (Tandai sebagai Terjual)
        const itemIds = stockItems.map(item => item._id);

        await StockItem.updateMany(
            { _id: { $in: itemIds } },
            { $set: { 
                isSold: true, 
                soldTo: user._id, 
                soldDate: new Date() 
            }},
            { session }
        );

        // 4. Update Saldo & Stok Produk Hitungan
        user.saldo -= totalCost;
        user.transaksi += 1;
        product.stock -= quantity;

        // 5. Buat Invoice
        const invoiceNumber = `INV-${Date.now()}`;
        const invoice = new Invoice({
            user: user._id,
            product: product._id,
            quantity: quantity,
            totalAmount: totalCost,
            invoiceNumber: invoiceNumber,
            status: 'PAID',
            distributedItems: itemIds 
        });

        await user.save({ session });
        await product.save({ session });
        await invoice.save({ session });

        await session.commitTransaction();

        res.json({ 
            message: `Pembelian sukses! Item dikirim melalui invoice.`, 
            invoice: {
                invoiceNumber: invoice.invoiceNumber,
                productName: product.name,
                totalAmount: totalCost,
                quantity: quantity
            }
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: 'Server error saat memproses pembelian.' });
    } finally {
        session.endSession();
    }
});

// @route   GET /api/data/invoice/:invoiceNumber
router.get('/invoice/:invoiceNumber', protect, async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNumber: req.params.invoiceNumber, user: req.user._id })
            .populate('product', 'name price imageURL')
            .populate({ 
                path: 'distributedItems',
                select: 'uniqueData'
            })
            .select('-__v');

        if (!invoice) return res.status(404).json({ message: 'Invoice tidak ditemukan.' });

        res.json(invoice);
    } catch (error) {
        res.status(500).json({ message: 'Server error saat mengambil data invoice.' });
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


// --------------------------------------------------------
// --- CRUD PRODUK (ADMIN) ---

// @route   POST /api/data/admin/products
router.post('/admin/products', protect, admin, async (req, res) => {
    const { name, price, description, imageURL } = req.body;
    try {
        const product = await Product.create({ name, price, description, imageURL, stock: 0 }); // Stock dibuat dari item unik
        res.status(201).json({ message: 'Produk berhasil ditambahkan! Stok awal 0.', product });
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

// --------------------------------------------------------
// --- TAMBAH STOK ITEM UNIK (ADMIN) ---

// @route   POST /api/data/admin/add-stock-item
router.post('/admin/add-stock-item', protect, admin, async (req, res) => {
    const { productId, items } = req.body;

    try {
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan.' });

        const stockDocuments = items.map(itemData => ({
            product: productId,
            uniqueData: itemData,
            isSold: false
        }));

        const insertedItems = await StockItem.insertMany(stockDocuments);
        
        // Update hitungan stok di model Product
        product.stock += insertedItems.length;
        await product.save();

        res.status(201).json({ 
            message: `${insertedItems.length} item stok unik berhasil ditambahkan untuk produk ${product.name}. Stok total: ${product.stock}` 
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --------------------------------------------------------
// --- CRUD INFORMASI (ADMIN) ---

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
