// api/models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    imageURL: { type: String, default: 'https://via.placeholder.com/150/ffffff/000000?text=Product' },
    stock: { type: Number, required: true, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Product', ProductSchema);
