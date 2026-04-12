const axios = require('axios');
const https = require('https');
const Order = require('../models/Order');
const UserBook = require('../models/UserBook');
const Book = require('../models/Book');
const sendEmail = require('../utils/sendEmail');

// Helper: verify a Paystack transaction reference
const verifyPaystackPayment = async (reference) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      timeout: 30000, // 30 second timeout
      httpsAgent: new https.Agent({ family: 4 }), // Force IPv4 to prevent Node.js DNS resolution hanging
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_LIVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

// Payment methods currently supported
const SUPPORTED_PAYMENT_METHODS = ['paystack'];

// @desc    Checkout — verify payment and create order
// @route   POST /api/orders/checkout
// @access  Private
const checkout = async (req, res) => {
  try {
    const { items, paymentMethod, transactionReference, paymentData } = req.body;

    // ── Validate paymentMethod ────────────────────
    if (!paymentMethod) {
      return res.status(400).json({ message: 'Please provide a paymentMethod' });
    }
    if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod.toLowerCase())) {
      return res.status(400).json({
        message: `Unsupported payment method: "${paymentMethod}". Supported methods: ${SUPPORTED_PAYMENT_METHODS.join(', ')}`,
      });
    }

    // ── Validate items ────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one item to purchase' });
    }

    // ── Replay protection ─────────────────────────
    if (!transactionReference) {
      return res.status(400).json({ message: 'Please provide a transactionReference' });
    }

    const existingOrder = await Order.findOne({ transactionReference });
    if (existingOrder) {
      return res.status(409).json({ message: 'This payment reference has already been used', orderId: existingOrder._id });
    }

    // ── Payment verification (route by method) ────
    let paystackData = {};

    if (paymentMethod === 'paystack') {
      if (!transactionReference) {
        return res.status(400).json({ message: 'Please provide a transactionReference for Paystack payments' });
      }
      try {
        const result = await verifyPaystackPayment(transactionReference);
        if (!result.status || result.data.status !== 'success') {
          return res.status(402).json({ message: 'Payment verification failed. Transaction is not successful.' });
        }
        paystackData = result.data;
      } catch (err) {
        const errMsg = err.response?.data?.message || err.message;
        return res.status(402).json({ message: `Paystack verification error: ${errMsg}` });
      }
    }
    // Future payment methods go here:
    // else if (paymentMethod === 'flutterwave') { ... }
    // else if (paymentMethod === 'stripe') { ... }

    // ── Fetch and validate books ──────────────────
    const bookIds = [...new Set(items)]; // deduplicate
    const books = await Book.find({ _id: { $in: bookIds }, isDeleted: false });

    if (books.length !== bookIds.length) {
      const foundIds = books.map((b) => b._id.toString());
      const missing = bookIds.filter((id) => !foundIds.includes(id));
      return res.status(404).json({ message: 'Some books were not found or are unavailable', missing });
    }

    // ── Build order items (snapshot) ──────────────
    const orderItems = books.map((book) => ({
      book: book._id,
      title: book.bookTitle,
      author: book.author,
      bookImage: book.bookImage,
      bookFormat: book.bookFormat,
      price: book.price,
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price, 0);

    // ── Create Order ─────────────────────────────
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod.toLowerCase(),
      status: 'completed',
      transactionReference,
      paymentData: typeof paymentData === 'string' ? paymentData : JSON.stringify(paymentData || paystackData),
      paidAt: new Date(),
    });

    // ── Grant books to user's library (upsert, skip duplicates) ──
    const libraryOps = books.map((book) => ({
      updateOne: {
        filter: { user: req.user._id, book: book._id },
        update: {
          $setOnInsert: {
            user: req.user._id,
            book: book._id,
            order: order._id,
            purchasedAt: order.paidAt,
            amountPaid: book.price,
            accessGranted: true,
          },
        },
        upsert: true,
      },
    }));

    await UserBook.bulkWrite(libraryOps);

    // ── Send order confirmation email (non-blocking) ──
    const formattedDate = new Date(order.paidAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const emailItems = order.items.map((item) => ({
      title: item.title,
      author: item.author,
      bookFormat: item.bookFormat || 'Digital',
      price: item.price.toLocaleString(),
      currency: order.currency,
    }));

    sendEmail({
      to: req.user.email,
      name: req.user.fullname,
      subject: `Order Confirmed — ${order.transactionReference}`,
      template: 'orderConfirmation',
      items: emailItems,
      totalAmount: order.totalAmount.toLocaleString(),
      currency: order.currency,
      transactionReference: order.transactionReference,
      paidAt: formattedDate,
    }).catch((err) => {
      console.error('Order confirmation email failed:', err.message);
    });

    return res.status(201).json({
      message: 'Purchase successful! Books added to your library.',
      order,
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


// @desc    Get logged-in user's order history
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-paymentData'); // don't expose raw Paystack payload to frontend

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get logged-in user's book library
// @route   GET /api/orders/my-library
// @access  Private
const getMyLibrary = async (req, res) => {
  try {
    const library = await UserBook.find({ user: req.user._id, accessGranted: true })
      .populate({
        path: 'book',
        select: 'bookTitle author aboutAuthor bookImage bookUrl bookFormat description category appleProductId',
        populate: { path: 'category' }
      })
      .sort({ purchasedAt: -1 });

    res.json(library);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Admin — get all orders (paginated)
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Optional filters
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'fullname email username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
      page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Admin — get a single order by ID
// @route   GET /api/orders/:id
// @access  Private/Admin
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'fullname email username')
      .populate('items.book', 'bookTitle author bookImage');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  checkout,
  getMyOrders,
  getMyLibrary,
  getAllOrders,
  getOrderById,
};
