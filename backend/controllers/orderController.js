const asyncHandler = require('express-async-handler');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const DELIVERY_FEE = 2.99;

// @desc    Create an order from the logged-in user's current cart
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty');
  }

  const itemsTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = DELIVERY_FEE;
  const total = itemsTotal + deliveryFee;

  const order = await Order.create({
    user: req.user._id,
    items: cart.items.map((item) => ({
      product: item.product,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: item.quantity,
    })),
    itemsTotal,
    deliveryFee,
    total,
    shippingAddress,
    paymentMethod: paymentMethod === 'cod' ? 'cod' : 'card',
    paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'unpaid',
  });

  // Empty the cart once the order is placed
  cart.items = [];
  await cart.save();

  res.status(201).json({ success: true, order });
});

// @desc    Get logged-in user's orders
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: orders.length, orders });
});

// @desc    Get a single order (owner or admin)
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }

  res.json({ success: true, order });
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
  res.json({ success: true, count: orders.length, orders });
});

// @desc    Update order status (e.g. preparing, out_for_delivery, delivered)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  order.status = status || order.status;
  const updated = await order.save();

  res.json({ success: true, order: updated });
});

module.exports = { createOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus };
