// api/routes/dashboardRoutes.js (Paket Server Lengkap & Ptero User Asli & Kontrol)
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Product = require('../models/Product');
const Information = require('../models/Information');
const Server = require('../models/Server'); // Import Model Server
const pteroService = require('../services/pterodactylService'); // Import Service
const mongoose = require('mongoose');

// --- USER ENDPOINTS (PROTECTED) ---

// @route   GET /api/data/dashboard-data
router.get('/dashboard-data', protect, async (req, res) => {
  const clearCache = Date.now(); // Debugging cache
  try {
    const user = await User.findById(req.user._id).select('-password');
    const products = await Product.find({ stock: { $gt: 0 } }).select('-createdAt -__v');
    const info = await Information.find({}).sort({ createdAt: -1 }).select('-__v');
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    res.json({ username: user.username, saldo: user.saldo, transaksi: user.transaksi, products, information: info });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// @route   POST /api/data/purchase (Pembelian Produk Biasa)
router.post('/purchase', protect, async (req, res) => {
    const { productId, quantity } = req.body;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const product = await Product.findById(productId).session(session);
        const user = await User.findById(req.user._id).session(session);
        if (!product) { await session.abortTransaction(); return res.status(404).json({ message: 'Produk tidak ditemukan.' }); }
        const totalCost = product.price * quantity;
        if (product.stock < quantity) { await session.abortTransaction(); return res.status(400).json({ message: 'Stok produk tidak mencukupi.' }); }
        if (user.saldo < totalCost) { await session.abortTransaction(); return res.status(400).json({ message: 'Saldo tidak mencukupi.' }); }
        user.saldo -= totalCost;
        user.transaksi += 1;
        product.stock -= quantity;
        await user.save({ session });
        await product.save({ session });
        await session.commitTransaction();
        res.json({ message: `Pembelian sukses! ${quantity} unit ${product.name} dikurangi.`, purchaseDetails: { productName: product.name, totalAmount: totalCost } });
    } catch (error) { await session.abortTransaction(); res.status(500).json({ message: error.message }); } finally { session.endSession(); }
});

// @route   POST /api/data/purchase/pterodactyl (PEMBELIAN SERVER PTERODACTYL)
router.post('/purchase/pterodactyl', protect, async (req, res) => {
    const { packageId, serverName } = req.body;
    const session = await mongoose.startSession();

    // --- DEFINISI PAKET SERVER ASLI ---
    // 🚨 WAJIB GANTI ID BERIKUT DENGAN ID ASLI DARI PTERODACTYL PANEL ANDA! 🚨
    const EGG_ID_DEFAULT = 15;      // Ganti dengan ID Egg yang sesuai (misal: Minecraft, Node.js)
    const NEST_ID_DEFAULT = 5;       // Ganti dengan ID Nest yang sesuai
    const ALLOCATION_ID_DEFAULT = 1; // Ganti dengan ID Alokasi IP:Port Default di Node Anda

    // Contoh Docker Image & Startup (Sesuaikan dengan Egg Anda!)
    const DOCKER_IMAGE_DEFAULT = 'ghcr.io/parkervcp/yolks:nodejs_24';
    const STARTUP_DEFAULT = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then      vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\n");      for line in $vars;     do export $line;     done fi;  /usr/local/bin/${CMD_RUN};';

    const SERVER_PACKAGES = {
        'ram_1gb': { name: 'Server 1GB', price: 1000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 1024, disk: 5120, cpu: 100, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_2gb': { name: 'Server 2GB', price: 2000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 2048, disk: 10240, cpu: 150, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_3gb': { name: 'Server 3GB', price: 3000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 3072, disk: 15360, cpu: 200, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_4gb': { name: 'Server 4GB', price: 4000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 4096, disk: 20480, cpu: 250, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_5gb': { name: 'Server 5GB', price: 5000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 5120, disk: 25600, cpu: 300, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_6gb': { name: 'Server 6GB', price: 6000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 6144, disk: 30720, cpu: 350, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_7gb': { name: 'Server 7GB', price: 7000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 7168, disk: 35840, cpu: 400, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_8gb': { name: 'Server 8GB', price: 8000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 8192, disk: 40960, cpu: 450, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_9gb': { name: 'Server 9GB', price: 9000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 9216, disk: 46080, cpu: 500, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_10gb': { name: 'Server 10GB', price: 9500, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 10240, disk: 51200, cpu: 550, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        'ram_unlimited': { name: 'Server Unlimited', price: 10000, eggId: EGG_ID_DEFAULT, nestId: NEST_ID_DEFAULT, limits: { memory: 0, disk: 0, cpu: 0, swap: 0 }, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_DEFAULT, startup_command: STARTUP_DEFAULT },
        // Anda bisa menambahkan environment, feature_limits per paket jika berbeda
    };
    // ------------------------------------

    const selectedPackage = SERVER_PACKAGES[packageId];
    if (!selectedPackage) return res.status(404).json({ message: 'Paket server tidak valid.' });
    if (!serverName || serverName.trim().length < 3) return res.status(400).json({ message: 'Nama server tidak valid (min 3 karakter).' });

    try {
        session.startTransaction();
        const user = await User.findById(req.user._id).session(session);
        if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User tidak ditemukan.' }); }
        if (user.saldo < selectedPackage.price) { await session.abortTransaction(); return res.status(400).json({ message: 'Saldo tidak mencukupi.' }); }

        // 1. Kurangi Saldo User
        user.saldo -= selectedPackage.price;
        user.transaksi += 1;
        await user.save({ session });

        // 2. Dapatkan/Buat User Pterodactyl (ASLI)
        const pteroUser = await pteroService.getOrCreatePteroUser(user);
        if (!pteroUser || !pteroUser.id) { throw new Error('Gagal mendapatkan ID User Pterodactyl.'); }

        // 3. Buat Server di Pterodactyl (ASLI)
        const pteroServerId = await pteroService.createNewServer(
            pteroUser.id,
            serverName.trim(), 
            selectedPackage 
        );

        // 4. Simpan Data Server ke Database Anda
        const serverEntry = new Server({
            user: user._id,
            productName: selectedPackage.name + ` (${serverName.trim()})`,
            pterodactylServerId: pteroServerId.toString(),
            pterodactylUserId: pteroUser.id.toString(),
            renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Renewal 1 bulan
            status: 'installing'
        });
        await serverEntry.save({ session });

        await session.commitTransaction();
        res.json({ message: `Server ${selectedPackage.name} berhasil dipesan! Instalasi sedang berlangsung.`, server: serverEntry });

    } catch (error) {
        await session.abortTransaction();
        console.error("Pterodactyl Purchase Error:", error.message);
        res.status(500).json({ message: `Gagal membuat server: ${error.message}` });
    } finally {
        session.endSession();
    }
});

// @route   GET /api/data/user-servers
router.get('/user-servers', protect, async (req, res) => {
    try {
        const servers = await Server.find({ user: req.user._id }).sort({ createdAt: -1 }).select('-__v');
        res.json(servers);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil daftar server.' });
    }
});

// @route   POST /api/data/server-control (ENDPOINT BARU UNTUK KONTROL SERVER)
router.post('/server-control', protect, async (req, res) => {
    const { serverId, command } = req.body; // serverId = Pterodactyl Server ID
    const validCommands = ['start', 'stop', 'restart', 'kill'];

    if (!validCommands.includes(command)) {
        return res.status(400).json({ message: 'Perintah tidak valid.' });
    }

    try {
        // Verifikasi kepemilikan server
        const server = await Server.findOne({ pterodactylServerId: serverId, user: req.user._id });
        if (!server) {
            return res.status(404).json({ message: 'Server tidak ditemukan atau Anda tidak punya akses.' });
        }

        // Panggil service Pterodactyl
        await pteroService.sendServerCommand(serverId, command);
        res.json({ message: `Sinyal ${command.toUpperCase()} berhasil dikirim ke server ${serverId}.` });

    } catch (error) {
        res.status(500).json({ message: `Gagal mengirim sinyal: ${error.message}` });
    }
});


// --- ADMIN ENDPOINTS ---
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
        if (isNaN(numericAmount) || numericAmount <= 0) return res.status(400).json({ message: 'Jumlah saldo tidak valid.' });
        user.saldo += numericAmount;
        user.transaksi += 1;
        await user.save();
        res.json({ message: `Saldo ${username} berhasil ditambah. Saldo baru: ${user.saldo}` });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// @route   POST /api/data/admin/products
router.post('/admin/products', protect, admin, async (req, res) => {
    const { name, price, description, imageURL, stock } = req.body;
    try {
        const product = await Product.create({ name, price, description, imageURL, stock: stock || 0 }); 
        res.status(201).json({ message: 'Produk berhasil ditambahkan! Stok awal diatur.', product });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// @route   DELETE /api/data/admin/products/:id
router.delete('/admin/products/:id', protect, admin, async (req, res) => {
    try {
        const result = await Product.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        res.json({ message: 'Produk berhasil dihapus.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// @route   POST /api/data/admin/info
router.post('/admin/info', protect, admin, async (req, res) => {
    const { title, content } = req.body;
    try {
        const info = await Information.create({ title, content, author: req.user._id });
        res.status(201).json({ message: 'Informasi berhasil diposting!', info });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
