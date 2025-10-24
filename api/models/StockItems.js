// api/models/StockItem.js
const mongoose = require('mongoose');

const StockItemSchema = new mongoose.Schema({
    product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    uniqueData: { 
        type: String, 
        required: true 
    },
    isSold: { 
        type: Boolean, 
        default: false 
    },
    soldTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    soldDate: { 
        type: Date 
    }
});

module.exports = mongoose.model('StockItem', StockItemSchema);
