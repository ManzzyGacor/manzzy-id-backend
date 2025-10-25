// api/routes/dashboardRoutes.js (LENGKAP FINAL - DIPASTIKAN ADA SALDO)
const express = require('express');
const router = express.Router();
// Pastikan middleware diimport dengan benar
const { protect, admin } = require('../middleware/authMiddleware');
// Pastikan semua model diimport dengan benar
const User = require('../models/User');
const Product = require('../models/Product');
const Information = require('../models/Information');
const Server = require('../models/Server'); // Pastikan Server model ada
// Pastikan service Pterodactyl diimport dengan benar
const pteroService = require('../services/pterodactylService');
const mongoose = require('mongoose');

// --- USER ENDPOINTS (PROTECTED) ---

// @route   GET /api/data/dashboard-data
// @desc    Mengambil data utama untuk dashboard user (saldo, produk, info)
router.get('/dashboard-data', protect, async (req, res) => {
  const clearCache = Date.now(); // Debugging cache Vercel
  try {
    // Pastikan req.user._id ada (dari middleware protect)
    if (!req.user || !req.user._id) {
        console.error("Error di /dashboard-data: req.user atau req.user._id tidak ditemukan.");
        return res.status(401).json({ message: 'User tidak terautentikasi dengan benar.' });
    }

    // === BAGIAN PENTING UNTUK SALDO ===
    // Mengambil data user TERMASUK saldo dan transaksi
    const user = await User.findById(req.user._id).select('-password');
    // ================================

    // Ambil produk yang stoknya lebih dari 0
    const products = await Product.find({ stock: { $gt: 0 } }).select('-createdAt -__v');

    // Ambil info terbaru
    const info = await Information.find({}).sort({ createdAt: -1 }).select('-__v');

    if (!user) {
        console.error(`Error di /dashboard-data: User dengan ID ${req.user._id} tidak ditemukan di DB.`);
        return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // === MEMASTIKAN SALDO & TRANSAKSI DIKIRIM ===
    // Pastikan saldo ada dan merupakan angka, jika tidak default ke 0
    const userSaldo = (typeof user.saldo === 'number') ? user.saldo : 0;
    const userTransaksi = (typeof user.transaksi === 'number') ? user.transaksi : 0;

    res.json({
        username: user.username,
        saldo: userSaldo, // <-- Saldo dikirim di sini
        transaksi: userTransaksi, // <-- Transaksi dikirim di sini
        products,
        information: info
    });
    // ===========================================

  } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Gagal mengambil data dashboard: " + error.message });
  }
});

// @route   POST /api/data/purchase (Pembelian Produk Biasa)
router.post('/purchase', protect, async (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0) return res.status(400).json({ message: 'Data tidak valid.' });
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const product = await Product.findById(productId).session(session);
        const user = await User.findById(req.user._id).session(session);
        if (!product || !user) { await session.abortTransaction(); return res.status(404).json({ message: 'Produk/User tidak ditemukan.' }); }
        const totalCost = product.price * quantity;
        if (product.stock < quantity) { await session.abortTransaction(); return res.status(400).json({ message: 'Stok habis.' }); }
        if (user.saldo < totalCost) { await session.abortTransaction(); return res.status(400).json({ message: 'Saldo kurang.' }); }
        user.saldo -= totalCost; user.transaksi += 1; product.stock -= quantity;
        await user.save({ session }); await product.save({ session });
        await session.commitTransaction();
        res.json({ message: `Sukses! ${quantity} ${product.name} dikurangi.`, purchaseDetails: { productName: product.name, totalAmount: totalCost } });
    } catch (error) { await session.abortTransaction(); console.error("Purchase Error:", error); res.status(500).json({ message: error.message }); } finally { session.endSession(); }
});

// @route   POST /api/data/purchase/pterodactyl (PEMBELIAN SERVER PTERODACTYL - Selalu Buat User Baru)
router.post('/purchase/pterodactyl', protect, async (req, res) => {
    const { packageId, serverName } = req.body;
    if (!packageId || !serverName || serverName.trim().length < 3) return res.status(400).json({ message: 'Paket/Nama server tidak valid.' });
    const session = await mongoose.startSession();

    // --- DEFINISI PAKET SERVER ---
    // 🚨 WAJIB GANTI ID & KONFIGURASI SESUAI PTERODACTYL PANEL ANDA! 🚨
    const EGG_ID_WHATSAPP = 15;      
    const NEST_ID_WHATSAPP = 5;       
    const LOCATION_ID_DEFAULT = 1;    // <<< GANTI DENGAN LOCATION ID KAMU! >>>
    const ENVIRONMENT_DEFAULT = { CMD_RUN: "node index.js" }; // GANTI 'node index.js' JIKA PERLU!
    const FEATURE_LIMITS_DEFAULT = { databases: 0, backups: 1, allocations: 1 }; 
    const IO_DEFAULT = 500; 

    const SERVER_PACKAGES = {
        'ram_1gb': { name: 'Node WA 1GB', price: 1000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 1024, disk: 5120, cpu: 100, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_2gb': { name: 'Node WA 2GB', price: 2000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 2048, disk: 10240, cpu: 150, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_3gb': { name: 'Node WA 3GB', price: 3000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 3072, disk: 15360, cpu: 200, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_4gb': { name: 'Node WA 4GB', price: 4000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 4096, disk: 20480, cpu: 250, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_5gb': { name: 'Node WA 5GB', price: 5000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 5120, disk: 25600, cpu: 300, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_6gb': { name: 'Node WA 6GB', price: 6000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 6144, disk: 30720, cpu: 350, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_7gb': { name: 'Node WA 7GB', price: 7000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 7168, disk: 35840, cpu: 400, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_8gb': { name: 'Node WA 8GB', price: 8000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 8192, disk: 40960, cpu: 450, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_9gb': { name: 'Node WA 9GB', price: 9000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 9216, disk: 46080, cpu: 500, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_10gb': { name: 'Node WA 10GB', price: 9500, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 10240, disk: 51200, cpu: 550, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
        'ram_unlimited': { name: 'Node WA Unlimited', price: 10000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 0, disk: 0, cpu: 0, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, locationId: LOCATION_ID_DEFAULT },
    };
    // ------------------------------------

    const selectedPackage = SERVER_PACKAGES[packageId];
    if (!selectedPackage) return res.status(404).json({ message: 'Paket server tidak valid.' });

    try {
        session.startTransaction();
        const user = await User.findById(req.user._id).session(session);
        if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User tidak ditemukan.' }); }
        if (user.saldo < selectedPackage.price) { await session.abortTransaction(); return res.status(400).json({ message: 'Saldo tidak mencukupi.' }); }

        // 1. Kurangi Saldo User
        user.saldo -= selectedPackage.price;
        user.transaksi += 1;
        await user.save({ session });

        // 2. BUAT USER PTERODACTYL BARU (Setiap Saat!)
        const pteroUserResult = await pteroService.createNewPteroUserForServer(user.username, serverName.trim());
        if (!pteroUserResult || !pteroUserResult.id) { throw new Error('Gagal membuat User Pterodactyl baru.'); }
        
        const pteroCredentials = { username: pteroUserResult.username, password: pteroUserResult.password };

        // 3. Buat Server di Pterodactyl (Milik user baru)
        const pteroServerId = await pteroService.createNewServer( pteroUserResult.id, serverName.trim(), selectedPackage );

        // 4. Simpan Data Server ke Database Anda
        const serverEntry = new Server({
            user: user._id,
            productName: selectedPackage.name + ` (${serverName.trim()})`,
            pterodactylServerId: pteroServerId.toString(),
            pterodactylUserId: pteroUserResult.id.toString(),
            renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
            status: 'installing'
        });
        await serverEntry.save({ session });

        await session.commitTransaction();
        res.json({ message: `Server ${selectedPackage.name} berhasil dipesan! Akun Pterodactyl baru telah dibuat.`, server: serverEntry, pterodactylCredentials: pteroCredentials });

    } catch (error) {
        await session.abortTransaction();
        console.error("Pterodactyl Purchase Error:", error.message);
        res.status(500).json({ message: `Gagal membuat server: ${error.message}` });
    } finally {
        session.endSession();
    }
});

// @route   GET /api/data/user-servers
router.get('/user-servers', protect, async (req, res) => { try { const servers = await Server.find({ user: req.user._id }).sort({ createdAt: -1 }).select('-__v'); res.json(servers); } catch (error) { console.error("Error fetching user servers:", error); res.status(500).json({ message: error.message }); } });

// @route   POST /api/data/server-control
router.post('/server-control', protect, async (req, res) => { const { serverId, command } = req.body; const validCommands = ['start', 'stop', 'restart', 'kill']; if (!serverId || !command || !validCommands.includes(command)) return res.status(400).json({ message: 'Data tidak valid.' }); try { const server = await Server.findOne({ pterodactylServerId: serverId, user: req.user._id }); if (!server) return res.status(404).json({ message: 'Server tidak ditemukan/akses ditolak.' }); await pteroService.sendServerCommand(serverId, command); res.json({ message: `Sinyal ${command} dikirim.` }); } catch (error) { console.error(`Error sending command ${command}:`, error); res.status(500).json({ message: error.message }); } });

// --- ADMIN ENDPOINTS ---
router.get('/admin/users', protect, admin, async (req, res) => { try { const users = await User.find({}).select('-password'); res.json(users); } catch (error) { res.status(500).json({ message: error.message }); } });
router.post('/admin/add-saldo', protect, admin, async (req, res) => { const { username, amount } = req.body; try { const user = await User.findOne({ username }); if (!user) return res.status(404).json({ message: 'User tidak ditemukan' }); const numericAmount = Number(amount); if (isNaN(numericAmount) || numericAmount <= 0) return res.status(400).json({ message: 'Jumlah tidak valid.' }); user.saldo += numericAmount; user.transaksi += 1; await user.save(); res.json({ message: `Saldo ${username} ditambah. Saldo baru: ${user.saldo}` }); } catch (error) { res.status(500).json({ message: error.message }); } });
router.post('/admin/products', protect, admin, async (req, res) => { const { name, price, description, imageURL, stock } = req.body; try { const existingProduct = await Product.findOne({ name }); if (existingProduct) return res.status(400).json({ message: 'Nama produk sudah ada.' }); const product = await Product.create({ name, price, description, imageURL, stock: stock || 0 }); res.status(201).json({ message: 'Produk ditambahkan!', product }); } catch (error) { res.status(500).json({ message: error.message }); } });
router.delete('/admin/products/:id', protect, admin, async (req, res) => { try { const product = await Product.findById(req.params.id); if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan.' }); await Product.deleteOne({ _id: req.params.id }); res.json({ message: 'Produk dihapus.' }); } catch (error) { res.status(500).json({ message: error.message }); } });
router.post('/admin/info', protect, admin, async (req, res) => { const { title, content } = req.body; try { if (!title || !content) return res.status(400).json({ message: 'Judul & isi wajib.' }); const info = await Information.create({ title, content, author: req.user._id }); res.status(201).json({ message: 'Info diposting!', info }); } catch (error) { res.status(500).json({ message: error.message }); } });

module.exports = router;
