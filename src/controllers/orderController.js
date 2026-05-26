const axios = require('axios');
const https = require('https');
const Order = require('../models/Order');
const UserBook = require('../models/UserBook');
const Book = require('../models/Book');
const User = require('../models/User');
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
const SUPPORTED_PAYMENT_METHODS = ['paystack', 'applepay'];

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
    } else if (paymentMethod === 'applepay') {
      // Apple Pay validation is handled on the client side.
      // We just rely on the transactionReference uniqueness check above.
      // Payment data is stored as is.
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
      authorId: book.authorProfile ? book.authorProfile.userId : undefined,
      bookImage: book.bookImage,
      bookFormat: book.bookFormat,
      isbn: book.isbn,
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
        select: 'bookTitle author aboutAuthor bookImage bookUrl bookFormat description category appleProductId tags isbn',
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
      .populate('items.book', 'bookTitle author bookImage isbn tags');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Admin — Verify a disputed payment via reference
// @route   GET /api/orders/verify-dispute/:reference
// @access  Private/Admin
const verifyDisputedPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const { paymentMethod } = req.query;
    
    if (!paymentMethod) {
      return res.status(400).json({ message: 'Please provide a paymentMethod' });
    }

    if (paymentMethod.toLowerCase() === 'applepay') {
      return res.status(400).json({ message: 'Resolving disputes is not available for Apple Pay at this time.' });
    }

    if (paymentMethod.toLowerCase() !== 'paystack') {
      return res.status(400).json({ message: `Unsupported payment method for disputes: ${paymentMethod}` });
    }
    
    // Check if order already exists in our DB
    const existingOrder = await Order.findOne({ transactionReference: reference }).populate('user', 'fullname email');
    
    // Call paystack
    let paystackData = null;
    let paymentSuccess = false;
    try {
      const result = await verifyPaystackPayment(reference);
      if (result.status && result.data && result.data.status === 'success') {
        paymentSuccess = true;
        paystackData = result.data;
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      return res.status(400).json({ message: `Payment verification failed: ${errMsg}` });
    }

    if (!paymentSuccess) {
      return res.status(404).json({ message: 'Payment was not successful or not found on Paystack', existingOrder });
    }

    if (existingOrder) {
      return res.status(200).json({ 
        message: 'Payment was received and order ALREADY exists. The user might be mistaken.', 
        orderExists: true,
        order: existingOrder,
        paymentData: paystackData
      });
    } else {
      return res.status(200).json({ 
        message: 'Payment was received but order DOES NOT exist. This order needs to be rectified.', 
        orderExists: false,
        paymentData: paystackData
      });
    }

  } catch (error) {
    console.error('Verify disputed payment error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Admin — Rectify a disputed order
// @route   POST /api/orders/rectify-dispute
// @access  Private/Admin
const rectifyDisputedOrder = async (req, res) => {
  try {
    const { transactionReference, paymentMethod, user: userId, paymentData, items, adminNotes } = req.body;

    if (!transactionReference || !paymentMethod || !userId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Please provide transactionReference, paymentMethod, user, and items' });
    }

    if (paymentMethod.toLowerCase() === 'applepay') {
      return res.status(400).json({ message: 'Resolving disputes is not available for Apple Pay at this time.' });
    }

    if (paymentMethod.toLowerCase() !== 'paystack') {
      return res.status(400).json({ message: `Unsupported payment method for disputes: ${paymentMethod}` });
    }

    const existingOrder = await Order.findOne({ transactionReference });
    if (existingOrder) {
      return res.status(409).json({ message: 'Order with this transaction reference already exists', orderId: existingOrder._id });
    }

    // Verify payment again to get actual paidAt, if paystack
    let actualPaidAt = new Date();
    let finalPaymentData = paymentData || {};
    
    if (paymentMethod.toLowerCase() === 'paystack') {
      try {
        const result = await verifyPaystackPayment(transactionReference);
        if (!result.status || result.data.status !== 'success') {
           return res.status(400).json({ message: 'Cannot rectify: Payment verification failed on Paystack.' });
        }
        finalPaymentData = result.data;
        if (result.data.paid_at) {
          actualPaidAt = new Date(result.data.paid_at);
        }
      } catch (err) {
        return res.status(400).json({ message: 'Paystack verification error', error: err.response?.data?.message || err.message });
      }
    }

    // Fetch and validate books
    const bookIds = [...new Set(items)]; 
    const books = await Book.find({ _id: { $in: bookIds }, isDeleted: false });

    if (books.length !== bookIds.length) {
      const foundIds = books.map((b) => b._id.toString());
      const missing = bookIds.filter((id) => !foundIds.includes(id));
      return res.status(404).json({ message: 'Some books were not found or are unavailable', missing });
    }

    // Build order items
    const orderItems = books.map((book) => ({
      book: book._id,
      title: book.bookTitle,
      author: book.author,
      authorId: book.authorProfile ? book.authorProfile.userId : undefined,
      bookImage: book.bookImage,
      bookFormat: book.bookFormat,
      isbn: book.isbn,
      price: book.price,
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price, 0);

    // Validate that the paid amount covers the books
    if (paymentMethod.toLowerCase() === 'paystack' && finalPaymentData.amount) {
      // Paystack returns amount in kobo, so divide by 100 to compare with NGN price
      const actualPaidAmount = finalPaymentData.amount / 100;
      if (totalAmount > actualPaidAmount) {
        return res.status(400).json({ 
          message: `Cannot rectify: The total price of the requested books (${totalAmount}) is higher than the amount actually paid (${actualPaidAmount}).` 
        });
      }
    }

    // Create Order
    const order = await Order.create({
      user: userId,
      items: orderItems,
      totalAmount,
      paymentMethod: paymentMethod.toLowerCase(),
      status: 'completed',
      transactionReference,
      paymentData: typeof finalPaymentData === 'string' ? finalPaymentData : JSON.stringify(finalPaymentData),
      paidAt: actualPaidAt,
      rectificationData: {
        isRectified: true,
        rectifiedAt: new Date(),
        actualPaymentReceivedAt: actualPaidAt,
        adminNotes: adminNotes || 'Rectified by admin'
      }
    });

    // Grant books to user's library
    const libraryOps = books.map((book) => ({
      updateOne: {
        filter: { user: userId, book: book._id },
        update: {
          $setOnInsert: {
            user: userId,
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
    
    // Optional: send email to user
    const affectedUser = await User.findById(userId);
    if (affectedUser) {
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
        to: affectedUser.email,
        name: affectedUser.fullname,
        subject: `Order Rectified & Confirmed — ${order.transactionReference}`,
        template: 'orderConfirmation',
        items: emailItems,
        totalAmount: order.totalAmount.toLocaleString(),
        currency: order.currency,
        transactionReference: order.transactionReference,
        paidAt: formattedDate,
      }).catch((err) => console.error('Rectified order email failed:', err.message));
    }

    return res.status(201).json({
      message: 'Disputed order rectified successfully.',
      order,
    });

  } catch (error) {
    console.error('Rectify disputed order error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get logged-in author's book sales (orders)
// @route   GET /api/orders/author-orders
// @access  Private/Author
const getAuthorOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // MongoDB aggregation pipeline to extract only the author's books from orders
    const pipeline = [
      // 1. Match orders that contain at least one item by this author
      { $match: { "items.authorId": req.user._id, status: "completed" } },
      // 2. Unwind the items array so each book is a separate document
      { $unwind: "$items" },
      // 3. Match again to keep ONLY the books written by this author
      { $match: { "items.authorId": req.user._id } },
      // 4. Sort by date descending
      { $sort: { paidAt: -1 } },
      // 5. Pagination
      { $skip: skip },
      { $limit: limit },
      // 6. Project the output to hide other books and only show relevant details
      {
        $project: {
          _id: 1,
          transactionReference: 1,
          paidAt: 1,
          currency: 1,
          buyerId: "$user",
          book: "$items",
        }
      }
    ];

    const countPipeline = [
      { $match: { "items.authorId": req.user._id, status: "completed" } },
      { $unwind: "$items" },
      { $match: { "items.authorId": req.user._id } },
      { $count: "total" }
    ];

    const [orders, countResult] = await Promise.all([
      Order.aggregate(pipeline),
      Order.aggregate(countPipeline)
    ]);

    // Populate buyer details
    const populatedOrders = await User.populate(orders, {
      path: "buyerId",
      select: "fullname email username profilePicture"
    });

    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      orders: populatedOrders,
      page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    console.error('getAuthorOrders error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  checkout,
  getMyOrders,
  getMyLibrary,
  getAllOrders,
  getOrderById,
  verifyDisputedPayment,
  rectifyDisputedOrder,
  getAuthorOrders,
};
