// api/index.js (Entry point untuk Vercel Serverless Function)

require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const MONGO_URI = process.env.MONGODB_URI;

// Middleware
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); 

// Koneksi ke MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Koneksi ke MongoDB Atlas berhasil!'))
  .catch(err => console.error('❌ Gagal koneksi ke MongoDB Atlas:', err));

// ROUTES
app.get('/api/test', (req, res) => {
  res.send('Backend Manzzy ID Aktif di Vercel!');
});

app.use('/api/auth', authRoutes); 
app.use('/api/data', dashboardRoutes); 

// EKSPOR APLIKASI UNTUK SERVERLESS FUNCTION VERCEL
module.exports = app;
