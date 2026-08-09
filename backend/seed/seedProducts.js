// Imports the frontend's products.json into MongoDB.
// Run with:  npm run seed          (import)
//            npm run seed:destroy  (wipe products collection)
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const rawProducts = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'products.json'), 'utf-8')
);

// Frontend stores price as a string like "$9.67" - convert to a number for the DB.
const products = rawProducts.map(({ id, name, price, image }) => ({
  name,
  price: parseFloat(String(price).replace('$', '')),
  image,
  description: '',
  category: 'general',
  isAvailable: true,
}));

const run = async () => {
  await connectDB();

  if (process.argv.includes('--destroy')) {
    await Product.deleteMany();
    console.log('Products collection cleared');
    process.exit(0);
  }

  await Product.deleteMany();
  const created = await Product.insertMany(products);
  console.log(`Seeded ${created.length} products`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
