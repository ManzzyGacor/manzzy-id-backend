// api/models/Server.js
const mongoose = require('mongoose');

const ServerSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productName: { type: String, required: true }, // Nama paket + nama server
    pterodactylServerId: { type: String, required: true, unique: true }, // ID server di Pterodactyl (bisa number/string tergantung API)
    pterodactylUserId: { type: String, required: true }, // ID user Pterodactyl
    status: { type: String, enum: ['active', 'suspended', 'installing', 'unknown'], default: 'installing' },
    renewalDate: { type: Date, required: true }, // Tanggal perpanjangan
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Server', ServerSchema);
