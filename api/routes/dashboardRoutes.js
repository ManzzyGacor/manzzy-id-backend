// api/routes/dashboardRoutes.js (LENGKAP FINAL - Dengan Semua Fitur & Ptero Asli)
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

    // --- DEFINISI PAKET SERVER ASLI (NODE WA DENGAN SEMUA FIELD) ---
    // 🚨 WAJIB GANTI ID & KONFIGURASI SESUAI PTERODACTYL PANEL ANDA! 🚨
    const EGG_ID_WHATSAPP = 1;      // Ganti ID Egg WA kamu
    const NEST_ID_WHATSAPP = 5;       // Ganti ID Nest WA kamu
    const ALLOCATION_ID_DEFAULT = 50; // GANTI DENGAN ID Alokasi IP:Port Default YANG TERSEDIA!

    // Konfigurasi Default untuk Node.js/WhatsApp Bot (SESUAIKAN!)
    const DOCKER_IMAGE_NODEJS = 'ghcr.io/parkervcp/yolks:nodejs_24'; // Ganti versi Node jika perlu
    const STARTUP_NODEJS = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then      vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\\n");      for line in $vars;     do export $line;     done fi;  /usr/local/bin/${CMD_RUN};';
    const ENVIRONMENT_DEFAULT = {}; // Kosong jika Egg tidak butuh variabel khusus saat create
    const FEATURE_LIMITS_DEFAULT = { databases: 0, backups: 0, allocations: 0 }; // Sesuaikan jumlah DB/Backup/Alokasi
    const IO_DEFAULT = 500; // Default IO Pterodactyl

    const SERVER_PACKAGES = {
        'ram_1gb': { name: 'Node WA 1GB', price: 1000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 1024, disk: 5120, cpu: 100, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_2gb': { name: 'Node WA 2GB', price: 2000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 2048, disk: 10240, cpu: 150, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_3gb': { name: 'Node WA 3GB', price: 3000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 3072, disk: 15360, cpu: 200, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_4gb': { name: 'Node WA 4GB', price: 4000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 4096, disk: 20480, cpu: 250, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_5gb': { name: 'Node WA 5GB', price: 5000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 5120, disk: 25600, cpu: 300, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_6gb': { name: 'Node WA 6GB', price: 6000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 6144, disk: 30720, cpu: 350, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_7gb': { name: 'Node WA 7GB', price: 7000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 7168, disk: 35840, cpu: 400, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_8gb': { name: 'Node WA 8GB', price: 8000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 8192, disk: 40960, cpu: 450, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_9gb': { name: 'Node WA 9GB', price: 9000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 9216, disk: 46080, cpu: 500, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_10gb': { name: 'Node WA 10GB', price: 9500, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 10240, disk: 51200, cpu: 550, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
        'ram_unlimited': { name: 'Node WA Unlimited', price: 10000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 0, disk: 0, cpu: 0, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, environment: ENVIRONMENT_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS },
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
            selectedPackage // Mengirim paket LENGKAP
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

// @route   POST /api/data/server-control
router.post('/server-control', protect, async (req, res) => {
    const { serverId, command } = req.body;
    const validCommands = ['start', 'stop', 'restart', 'kill'];

    if (!validCommands.includes(command)) {
        return res.status(400).json({ message: 'Perintah tidak valid.' });
    }

    try {
        const server = await Server.findOne({ pterodactylServerId: serverId, user: req.user._id });
        if (!server) {
            return res.status(404).json({ message: 'Server tidak ditemukan atau Anda tidak punya akses.' });
        }
        await pteroService.sendServerCommand(serverId, command);
        res.json({ message: `Sinyal ${command.toUpperCase()} berhasil dikirim ke server ${serverId}.` });

    } catch (error) {
        res.status(500).json({ message: `Gagal mengirim sinyal: ${error.message}` });
    }
});


// --- ADMIN ENDPOINTS ---
// @route   GET /api/data/admin/users
router.get('/admin/users', protect, admin, async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: "Gagal mengambil daftar pengguna." });
    }
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
    } catch (error) {
        console.error("Error adding saldo:", error);
        res.status(500).json({ message: "Gagal menambahkan saldo." });
    }
});

// @route   POST /api/data/admin/products
router.post('/admin/products', protect, admin, async (req, res) => {
    const { name, price, description, imageURL, stock } = req.body;
    try {
        const existingProduct = await Product.findOne({ name });
        if (existingProduct) return res.status(400).json({ message: 'Nama produk sudah digunakan.' });
        const product = await Product.create({ name, price, description, imageURL, stock: stock || 0 });
        res.status(201).json({ message: 'Produk berhasil ditambahkan!', product });
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: "Gagal menambahkan produk." });
    }
});

// @route   DELETE /api/data/admin/products/:id
router.delete('/admin/products/:id', protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        await Product.deleteOne({ _id: req.params.id });
        res.json({ message: 'Produk berhasil dihapus.' });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Gagal menghapus produk." });
    }
});

// @route   POST /api/data/admin/info
router.post('/admin/info', protect, admin, async (req, res) => {
    const { title, content } = req.body;
    try {
        if (!title || !content) return res.status(400).json({ message: 'Judul dan isi informasi wajib diisi.' });
        const info = await Information.create({ title, content, author: req.user._id });
        res.status(201).json({ message: 'Informasi berhasil diposting!', info });
    } catch (error) {
        console.error("Error posting information:", error);
        res.status(500).json({ message: "Gagal memposting informasi." });
    }
});

module.exports = router; // Pastikan ini ada di baris paling akhir file
