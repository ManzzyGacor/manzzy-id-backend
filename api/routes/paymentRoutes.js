// api/routes/paymentRoutes.js (Minimal Top Up Rp 1.000)
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const crypto = require('crypto'); // Dibutuhkan untuk verifikasi callback

// --- Endpoint untuk membuat URL redirect Pakasir ---
// @route   POST /api/payment/create-pakasir
router.post('/create-pakasir', protect, async (req, res) => {
    const { amount } = req.body;
    const user = req.user; 

    // 1. Validasi Input (SERVER-SIDE)
    const numericAmount = Number(amount);
    // === Validasi Minimal 1000 ===
    if (isNaN(numericAmount) || numericAmount < 1000) { 
        return res.status(400).json({ message: 'Jumlah top up tidak valid (minimal Rp 1.000).' });
    }
    // ========================

    // 2. Ambil data dari Environment Variables
    const pakasirSlug = process.env.PAKASIR_SLUG;
    if (!pakasirSlug) {
        console.error("PAKASIR_SLUG belum di-set di Vercel Environment Variables.");
        return res.status(500).json({ message: 'Konfigurasi payment gateway belum lengkap.' });
    }

    // 3. Buat Order ID unik
    const orderId = `MANZZY-${user._id}-${Date.now()}`; 
    
    // (Opsional: Simpan orderId, amount, userId, status 'pending' ke DB kamu di sini)

    // 4. Buat URL Redirect Pakasir
    const paymentUrl = `https://app.pakasir.com/pay/${pakasirSlug}/${numericAmount}?order_id=${orderId}&qris_only=1`;

    console.log("Mengarahkan user ke Pakasir URL:", paymentUrl);

    // 5. Kirim URL kembali ke frontend
    res.json({ paymentUrl: paymentUrl });
});


// @route   POST /api/payment/pakasir-callback
// @desc    Menerima notifikasi webhook dari Pakasir (WAJIB DIBUAT & DIAMANKAN)
router.post('/pakasir-callback', async (req, res) => {
    const data = req.body;
    const signature = req.headers['x-pakasir-signature']; 
    const pakasirSecret = process.env.PAKASIR_SECRET_KEY;

    console.log("Menerima Callback Pakasir:", JSON.stringify(data));

    if (!pakasirSecret) {
        console.error("PAKASIR_SECRET_KEY belum di-set. Callback tidak bisa diverifikasi.");
        return res.status(500).send('Internal Server Error (No Secret)');
    }
    if (!signature) {
        console.warn("Callback Pakasir diterima TANPA signature.");
        return res.status(401).send('Invalid request (No Signature)');
    }

    try {
        // 1. Verifikasi Signature (WAJIB - Cek dokumentasi Pakasir caranya)
        const hmac = crypto.createHmac('sha256', pakasirSecret);
        const digest = hmac.update(JSON.stringify(req.body)).digest('hex'); 

        if (digest !== signature) {
            console.warn("Callback Pakasir GAGAL verifikasi signature.");
            return res.status(401).send('Invalid signature');
        }
        
        console.log("Callback Pakasir signature TERVERIFIKASI.");

        // 2. Cek Status Pembayaran
        if (data.status && (data.status.toLowerCase() === 'success' || data.status.toLowerCase() === 'paid')) {
            const orderId = data.order_id;
            const amount = Number(data.amount); 
            
            // 3. (Opsional) Cek Order ID di DB kamu, pastikan belum diproses
            
            // 4. Cari User (parsing dari orderId unik kita)
            const userId = orderId.split('-')[1]; // Ambil userId dari 'MANZZY-userId-timestamp'
            const user = await User.findById(userId);

            if (user) {
                // 5. TAMBAH SALDO USER
                user.saldo += amount;
                user.transaksi += 1;
                await user.save();
                console.log(`SUKSES: Saldo untuk User ID ${userId} berhasil ditambahkan sebesar ${amount}.`);
            } else {
                console.error(`Callback Pakasir sukses, tapi User ID ${userId} dari order ${orderId} tidak ditemukan.`);
            }
        } else {
            console.log(`Callback Pakasir diterima untuk order ${data.order_id} dengan status: ${data.status}`);
        }
        
        // 6. Balas ke Pakasir bahwa callback diterima
        res.status(200).send('OK');

    } catch (error) {
        console.error("Error memproses callback Pakasir:", error.message);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;
