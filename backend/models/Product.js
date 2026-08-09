const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true },
    category: { type: String, default: 'general', trim: true },
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
