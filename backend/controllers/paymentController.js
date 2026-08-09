const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');

const stripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);
const stripe = stripeEnabled ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// @desc    Create a payment intent (or a mock one in dev mode) for an order
// @route   POST /api/payments/create-intent
// @access  Private
const createPaymentIntent = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    res.status(400);
    throw new Error('orderId is required');
  }

  const order = await Order.findById(orderId);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to pay for this order');
  }

  if (order.paymentStatus === 'paid') {
    res.status(400);
    throw new Error('Order is already paid');
  }

  // Real Stripe flow
  if (stripeEnabled) {
    const amountInCents = Math.round(order.total * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: { orderId: order._id.toString(), userId: req.user._id.toString() },
      automatic_payment_methods: { enabled: true },
    });

    order.paymentIntentId = paymentIntent.id;
    await order.save();

    return res.json({
      success: true,
      mode: 'stripe',
      clientSecret: paymentIntent.client_secret,
    });
  }

  // Mock/dev flow - no Stripe key configured. Lets the frontend flow work end to end
  // in local development without real payment credentials.
  const mockIntentId = `mock_pi_${order._id}_${Date.now()}`;
  order.paymentIntentId = mockIntentId;
  await order.save();

  res.json({
    success: true,
    mode: 'mock',
    clientSecret: `mock_secret_${mockIntentId}`,
    message: 'STRIPE_SECRET_KEY not set - running in mock payment mode. Use /api/payments/confirm-mock to mark this order as paid.',
  });
});

// @desc    Confirm a mock payment (dev mode only, no real Stripe key configured)
// @route   POST /api/payments/confirm-mock
// @access  Private
const confirmMockPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (stripeEnabled) {
    res.status(400);
    throw new Error('Stripe is configured - use the real payment confirmation flow, not the mock endpoint');
  }

  const order = await Order.findById(orderId);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to confirm payment for this order');
  }

  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  await order.save();

  res.json({ success: true, order });
});

// @desc    Stripe webhook - confirms payment server-side when Stripe is configured
// @route   POST /api/payments/webhook
// @access  Public (verified via Stripe signature)
const stripeWebhook = asyncHandler(async (req, res) => {
  if (!stripeEnabled) {
    return res.status(400).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;

    if (orderId) {
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
        await order.save();
      }
    }
  }

  res.json({ received: true });
});

module.exports = { createPaymentIntent, confirmMockPayment, stripeWebhook };
