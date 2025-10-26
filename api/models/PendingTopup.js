// api/models/PendingTopup.js
const mongoose = require('mongoose');

const PendingTopupSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '2d' // Hapus data pending setelah 2 hari
    }
});

module.exports = mongoose.model('PendingTopup', PendingTopupSchema);
