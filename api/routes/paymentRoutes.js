// api/routes/paymentRoutes.js (VERSI AMAN - Sesuai Dokumentasi Pakasir)
const express = require('express');
const router = express.Router();
const axios = require('axios'); // Pastikan axios sudah di-install
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const PendingTopup = require('../models/PendingTopup'); // Pastikan model ini ada
const mongoose = require('mongoose');

// --- Endpoint untuk membuat URL redirect Pakasir ---
// @route   POST /api/payment/create-pakasir
router.post('/create-pakasir', protect, async (req, res) => {
    const { amount } = req.body;
    const user = req.user; 

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 1000) { 
        return res.status(400).json({ message: 'Jumlah top up tidak valid (minimal Rp 1.000).' });
    }

    const pakasirSlug = process.env.PAKASIR_SLUG;
    if (!pakasirSlug) {
        console.error("PAKASIR_SLUG belum di-set.");
        return res.status(500).json({ message: 'Konfigurasi payment gateway belum lengkap (slug).' });
    }

    const orderId = `MANZZY-${user._id}-${Date.now()}`; 
    
    try {
        // 1. SIMPAN Transaksi Pending ke Database kita
        await PendingTopup.create({
            userId: user._id,
            orderId: orderId,
            amount: numericAmount,
            status: 'pending'
        });

        // 2. Buat URL Redirect Pakasir
        // Sesuai file PHP, kita tambahkan redirect URL kembali ke dashboard
        const redirectUrl = encodeURIComponent(`https://${req.hostname}/dashboard.html`); // Ganti jika domain frontend beda
        const paymentUrl = `https://app.pakasir.com/pay/${pakasirSlug}/${numericAmount}?order_id=${orderId}&qris_only=1&redirect=${redirectUrl}`;

        console.log("Mengarahkan user ke Pakasir URL:", paymentUrl);
        res.json({ paymentUrl: paymentUrl });

    } catch (error) {
        console.error("Gagal membuat data PendingTopup:", error);
        res.status(500).json({ message: 'Gagal mencatat transaksi sebelum redirect.' });
    }
});


// @route   POST /api/payment/pakasir-callback
// @desc    Menerima notifikasi webhook dari Pakasir (LOGIKA VERIFIKASI BARU)
router.post('/pakasir-callback', async (req, res) => {
    const data = req.body;
    const orderId = data.order_id; // Ambil order_id dari body callback

    // Ambil Kunci API & Project/Slug dari Vercel
    const pakasirApiKey = process.env.PAKASIR_API_KEY; // <-- WAJIB ADA (dari Dok E)
    const pakasirSlug = process.env.PAKASIR_SLUG;       // <-- WAJIB ADA

    console.log("Menerima Callback Pakasir untuk orderId:", orderId);

    // HAPUS SEMUA LOGIKA VERIFIKASI SIGNATURE (karena kita verifikasi ulang)
    
    if (!pakasirApiKey || !pakasirSlug) {
        console.error("PAKASIR_API_KEY atau PAKASIR_SLUG belum di-set.");
        return res.status(500).send('Internal Server Error (Config)');
    }
    if (!orderId) {
        return res.status(400).send('Invalid request (No order_id)');
    }

    let pendingTx = null; 

    try {
        // 1. Cari transaksi di DB kita
        pendingTx = await PendingTopup.findOne({ orderId: orderId });
        
        if (!pendingTx) {
            console.warn(`Callback untuk orderId ${orderId} tidak ditemukan di DB pending.`);
            return res.status(404).send('Order ID not found');
        }

        // 2. Cek jika sudah diproses
        if (pendingTx.status === 'completed') {
            console.log(`Callback untuk orderId ${orderId} sudah diproses sebelumnya.`);
            return res.status(200).send('OK (Already Processed)');
        }

        // 3. VERIFIKASI ULANG ke API Pakasir (Cara Aman Sesuai Dok E & file PHP)
        const verificationUrl = `https://app.pakasir.com/api/transactiondetail?project=${pakasirSlug}&amount=${pendingTx.amount}&order_id=${orderId}&api_key=${pakasirApiKey}`;
        
        console.log(`Memverifikasi ulang ke Pakasir: ${orderId}`);
        const pakasirResponse = await axios.get(verificationUrl); // Panggil API Pakasir
        
        const txDetail = pakasirResponse.data;

        // 4. Cek Status Asli dari Pakasir
        // (Sesuai Dok E, status sukses adalah "completed")
        if (txDetail.transaction && txDetail.transaction.status.toLowerCase() === 'completed') {
            
            console.log(`Verifikasi sukses untuk orderId ${orderId}. Status: COMPLETED.`);

            // 5. Mulai Transaksi Database untuk tambah saldo
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                const user = await User.findById(pendingTx.userId).session(session);
                if (!user) {
                    throw new Error(`User ID ${pendingTx.userId} tidak ditemukan.`);
                }

                // Tambah Saldo
                user.saldo += pendingTx.amount;
                user.transaksi += 1;
                await user.save({ session });

                // Update status transaksi pending menjadi completed
                pendingTx.status = 'completed';
                await pendingTx.save({ session });

                await session.commitTransaction();
                console.log(`SUKSES: Saldo untuk User ID ${user._id} berhasil ditambahkan sebesar ${pendingTx.amount}.`);
                
            } catch (dbError) {
                await session.abortTransaction();
                console.error(`Error saat update DB (Callback): ${dbError.message}`);
                throw dbError; // Lempar error agar ditangkap catch utama
            } finally {
                session.endSession();
            }

        } else {
            // Jika status dari Pakasir BUKAN 'completed'
            console.warn(`Verifikasi orderId ${orderId} statusnya BUKAN completed. Status: ${txDetail.transaction?.status}`);
            pendingTx.status = 'failed'; // Tandai gagal
            await pendingTx.save();
        }
        
        // 6. Balas ke Pakasir bahwa callback diterima
        res.status(200).send('OK');

    } catch (error) {
        console.error("Error memproses callback Pakasir:", error.response ? (error.response.data || error.message) : error.message);
        // Jika transaksi pending ditemukan tapi gagal verif, update status
        if(pendingTx && pendingTx.status === 'pending') {
            pendingTx.status = 'failed';
            await pendingTx.save();
        }
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;                
