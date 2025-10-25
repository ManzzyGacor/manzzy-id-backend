// api/routes/dashboardRoutes.js (Paket Server Node WA - Tanpa Environment)
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Product = require('../models/Product');
const Information = require('../models/Information');
const Server = require('../models/Server');
const pteroService = require('../services/pterodactylService');
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
    // ... (Logika pembelian produk biasa tetap sama) ...
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

// @route   POST /api/data/purchase/pterodactyl (PEMBELIAN SERVER PTERODACTYL - Node WhatsApp Tanpa Env)
router.post('/purchase/pterodactyl', protect, async (req, res) => {
    const { packageId, serverName } = req.body;
    const session = await mongoose.startSession();

    // --- DEFINISI PAKET SERVER ASLI (NODE WA - TANPA ENV) ---
    // 🚨 WAJIB GANTI ID ALOKASI & VERIFIKASI KONFIGURASI EGG/NEST! 🚨
    const EGG_ID_WHATSAPP = 1;      // Sesuai permintaan kamu
    const NEST_ID_WHATSAPP = 5;       // Sesuai permintaan kamu
    const ALLOCATION_ID_DEFAULT = 1; // GANTI DENGAN ID Alokasi IP:Port Default di Node Anda!

    // Konfigurasi Default untuk Node.js/WhatsApp Bot (SESUAIKAN!)
    const DOCKER_IMAGE_NODEJS = 'ghcr.io/parkervcp/yolks:nodejs_24'; // Ganti versi Node jika perlu
    const STARTUP_NODEJS = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then      vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\n");      for line in $vars;     do export $line;     done fi;  /usr/local/bin/${CMD_RUN};'; // Ganti index.js jika nama file utama beda
    // HAPUS: const ENVIRONMENT_WHATSAPP = { ... };
   const ENVIRONMENT_DEFAULT = {};
  const FEATURE_LIMITS_DEFAULT = { databases: 0, backups: 1, allocations: 1 }; // Sesuaikan
    const IO_DEFAULT = 500;

    const SERVER_PACKAGES = {
        'ram_1gb': { name: 'Panel WA 1GB', price: 1000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 1024, disk: 5120, cpu: 100, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_2gb': { name: 'Panel WA 2GB', price: 2000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 2048, disk: 10240, cpu: 150, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_3gb': { name: 'Panel WA 3GB', price: 3000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 3072, disk: 15360, cpu: 200, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_4gb': { name: 'Panel WA 4GB', price: 4000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 4096, disk: 20480, cpu: 250, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_5gb': { name: 'Panel WA 5GB', price: 5000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 5120, disk: 25600, cpu: 300, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_6gb': { name: 'Panel WA 6GB', price: 6000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 6144, disk: 30720, cpu: 350, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_7gb': { name: 'Panel WA 7GB', price: 7000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 7168, disk: 35840, cpu: 400, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_8gb': { name: 'Panel WA 8GB', price: 8000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 8192, disk: 40960, cpu: 450, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_9gb': { name: 'Panel WA 9GB', price: 9000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 9216, disk: 46080, cpu: 500, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_10gb': { name: 'Panel WA 10GB', price: 9500, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 10240, disk: 51200, cpu: 550, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
        'ram_unlimited': { name: 'Panel WA Unlimited', price: 10000, eggId: EGG_ID_WHATSAPP, nestId: NEST_ID_WHATSAPP, limits: { memory: 0, disk: 0, cpu: 0, swap: 0, io: IO_DEFAULT }, feature_limits: FEATURE_LIMITS_DEFAULT, default_allocation_id: ALLOCATION_ID_DEFAULT, docker_image: DOCKER_IMAGE_NODEJS, startup_command: STARTUP_NODEJS }, // Hapus env
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
            selectedPackage // Kirim seluruh objek konfigurasi paket (tanpa env)
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
// ... (GET /admin/users, POST /admin/add-saldo, POST/DELETE /admin/products, POST /admin/info tetap sama) ...

module.exports = router;
