// api/index.js (Memuat paymentRoutes)

require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const paymentRoutes = require('./routes/paymentRoutes'); // <-- TAMBAHAN BARU

const app = express();
const MONGO_URI = process.env.MONGODB_URI;

// Middleware
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); // Izinkan akses dari frontend Vercel

// Koneksi ke MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true, 
    serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log('✅ Koneksi ke MongoDB Atlas berhasil!'))
  .catch(err => console.error('❌ Gagal koneksi ke MongoDB Atlas:', err.message));

// ROUTES
app.get('/api/test', (req, res) => {
  res.send('Backend Manzzy ID Aktif di Vercel!');
});

app.use('/api/auth', authRoutes); 
app.use('/api/data', dashboardRoutes);
app.use('/api/payment', paymentRoutes); // <-- TAMBAHAN BARU

// EKSPOR APLIKASI UNTUK SERVERLESS FUNCTION VERCEL
module.exports = app;
