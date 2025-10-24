// api/models/Invoice.js
const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PAID' }, 
    invoiceNumber: { type: String, unique: true },
    purchaseDate: { type: Date, default: Date.now },
    distributedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StockItem' }] // Item unik yang didistribusikan
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
