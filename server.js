const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const winston = require('winston');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 8080;

// Supported currencies and their validation rules
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 1000000;

// Mock currency conversion rates (base: USD)
const CURRENCY_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.90,
  CNY: 7.24
};

// In-memory payment storage (in production, use a database)
const payments = new Map();
const customerPayments = new Map(); // customerEmail -> [paymentIds]

// Configure Winston logger for structured logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'payment-app' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Configure Prometheus metrics
const register = new client.Registry();

// Define custom metrics following Prometheus naming conventions
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const paymentRequestsTotal = new client.Counter({
  name: 'payment_requests_total',
  help: 'Total number of payment requests',
  labelNames: ['status', 'currency'],
  registers: [register]
});

const paymentAmount = new client.Gauge({
  name: 'payment_amount',
  help: 'Total amount of all payments by currency',
  labelNames: ['currency'],
  registers: [register]
});

const paymentAmountDollars = new client.Histogram({
  name: 'payment_amount_dollars',
  help: 'Distribution of payment amounts in dollars',
  labelNames: ['currency'],
  registers: [register],
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
});

const paymentProcessingDurationSeconds = new client.Histogram({
  name: 'payment_processing_duration_seconds',
  help: 'Payment processing duration in seconds',
  labelNames: ['operation', 'status'],
  registers: [register],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const paymentsByStatus = new client.Gauge({
  name: 'payments_by_status',
  help: 'Number of payments by status',
  labelNames: ['status'],
  registers: [register]
});

const paymentErrorsTotal = new client.Counter({
  name: 'payment_errors_total',
  help: 'Total number of payment errors',
  labelNames: ['error_type', 'currency'],
  registers: [register]
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

const concurrentPayments = new client.Gauge({
  name: 'concurrent_payments',
  help: 'Number of payments currently being processed',
  registers: [register]
});

const currencyConversionsTotal = new client.Counter({
  name: 'currency_conversions_total',
  help: 'Total number of currency conversions',
  labelNames: ['from_currency', 'to_currency'],
  registers: [register]
});

const paymentValidationFailuresTotal = new client.Counter({
  name: 'payment_validation_failures_total',
  help: 'Total number of payment validation failures',
  labelNames: ['validation_type'],
  registers: [register]
});

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Helper functions
function validatePaymentRequest(data) {
  const errors = [];
  
  if (!data.customerName || data.customerName.trim().length < 2) {
    errors.push('customerName must be at least 2 characters');
    paymentValidationFailuresTotal.inc({ validation_type: 'customer_name' });
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email address is required');
    paymentValidationFailuresTotal.inc({ validation_type: 'email_format' });
  }
  
  if (!data.amount || isNaN(data.amount)) {
    errors.push('Valid amount is required');
    paymentValidationFailuresTotal.inc({ validation_type: 'amount_invalid' });
  } else {
    const amount = parseFloat(data.amount);
    if (amount < MIN_AMOUNT) {
      errors.push(`Amount must be at least ${MIN_AMOUNT}`);
      paymentValidationFailuresTotal.inc({ validation_type: 'amount_minimum' });
    }
    if (amount > MAX_AMOUNT) {
      errors.push(`Amount must not exceed ${MAX_AMOUNT}`);
      paymentValidationFailuresTotal.inc({ validation_type: 'amount_maximum' });
    }
  }
  
  if (!data.currency || !SUPPORTED_CURRENCIES.includes(data.currency.toUpperCase())) {
    errors.push(`Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`);
    paymentValidationFailuresTotal.inc({ validation_type: 'currency_unsupported' });
  }
  
  return errors;
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const fromRate = CURRENCY_RATES[fromCurrency.toUpperCase()];
  const toRate = CURRENCY_RATES[toCurrency.toUpperCase()];
  
  if (!fromRate || !toRate) {
    throw new Error('Unsupported currency for conversion');
  }
  
  const amountInUSD = amount / fromRate;
  const convertedAmount = amountInUSD * toRate;
  
  currencyConversionsTotal.inc({ from_currency: fromCurrency, to_currency: toCurrency });
  
  return convertedAmount;
}

function updatePaymentStatusMetrics() {
  const statusCounts = {
    pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    expired: 0
  };
  
  payments.forEach(payment => {
    if (statusCounts.hasOwnProperty(payment.status)) {
      statusCounts[payment.status]++;
    }
  });
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    paymentsByStatus.set({ status }, count);
  });
}

function checkExpiredPayments() {
  const now = new Date();
  let expiredCount = 0;
  
  payments.forEach((payment, id) => {
    if (payment.status === 'pending' && new Date(payment.expiryDate) < now) {
      payment.status = 'expired';
      expiredCount++;
      logger.info('Payment expired', { paymentId: id, customerName: payment.customerName });
    }
  });
  
  if (expiredCount > 0) {
    updatePaymentStatusMetrics();
    logger.info(`Expired ${expiredCount} payments`);
  }
}

// Check for expired payments every minute
setInterval(checkExpiredPayments, 60000);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Metrics middleware - track active connections
app.use((req, res, next) => {
  activeConnections.inc();
  res.on('finish', () => {
    activeConnections.dec();
  });
  next();
});

// Request duration tracking middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status: res.statusCode
    });
    
    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route: route,
        status: res.statusCode
      },
      duration / 1000
    );
  });
  next();
});

// Serve the main page
app.get('/', (req, res) => {
  logger.info('Serving main page', { ip: req.ip });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Payment generation endpoint
app.post('/api/payments', async (req, res) => {
  const startTime = Date.now();
  const processingStart = Date.now();
  
  try {
    concurrentPayments.inc();
    
    const { customerName, email, amount, currency, description } = req.body;

    logger.info('Payment request received', { 
      customerName, 
      email,
      amount, 
      currency,
      ip: req.ip 
    });

    // Enhanced validation
    const validationErrors = validatePaymentRequest(req.body);
    if (validationErrors.length > 0) {
      logger.warn('Payment validation failed', { errors: validationErrors });
      
      paymentRequestsTotal.inc({ status: 'validation_failed', currency: currency || 'unknown' });
      paymentProcessingDurationSeconds.observe(
        { operation: 'create', status: 'validation_failed' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    // Generate payment object
    const payment = {
      paymentId: uuidv4(),
      customerName: customerName.trim(),
      email: email.toLowerCase().trim(),
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      description: description ? description.trim() : 'No description provided',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    };

    // Store payment
    payments.set(payment.paymentId, payment);
    
    // Track customer payments
    if (!customerPayments.has(payment.email)) {
      customerPayments.set(payment.email, []);
    }
    customerPayments.get(payment.email).push(payment.paymentId);

    // Log payment generation
    logger.info('Payment generated successfully', { 
      paymentId: payment.paymentId,
      customerName: payment.customerName,
      email: payment.email,
      amount: payment.amount,
      currency: payment.currency,
      processingTime: Date.now() - startTime
    });

    // Update metrics
    paymentRequestsTotal.inc({ status: 'success', currency: payment.currency });
    paymentAmount.inc({ currency: payment.currency }, payment.amount);
    paymentAmountDollars.observe({ currency: payment.currency }, payment.amount);
    paymentProcessingDurationSeconds.observe(
      { operation: 'create', status: 'success' },
      (Date.now() - processingStart) / 1000
    );
    updatePaymentStatusMetrics();

    res.status(201).json({
      success: true,
      payment
    });
  } catch (error) {
    logger.error('Error generating payment', { 
      error: error.message, 
      stack: error.stack,
      ip: req.ip 
    });
    
    paymentRequestsTotal.inc({ status: 'error', currency: req.body.currency || 'unknown' });
    paymentErrorsTotal.inc({ 
      error_type: 'internal_error', 
      currency: req.body.currency || 'unknown' 
    });
    paymentProcessingDurationSeconds.observe(
      { operation: 'create', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    concurrentPayments.dec();
  }
});

// Get payment by ID
app.get('/api/payments/:paymentId', (req, res) => {
  const processingStart = Date.now();
  
  try {
    const { paymentId } = req.params;
    const payment = payments.get(paymentId);

    if (!payment) {
      logger.warn('Payment not found', { paymentId });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'retrieve', status: 'not_found' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    logger.info('Payment retrieved', { paymentId, customerEmail: payment.email });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'retrieve', status: 'success' },
      (Date.now() - processingStart) / 1000
    );

    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    logger.error('Error retrieving payment', { error: error.message, paymentId: req.params.paymentId });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'retrieve', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get customer payment history
app.get('/api/customers/:email/payments', (req, res) => {
  const processingStart = Date.now();
  
  try {
    const { email } = req.params;
    const customerPaymentIds = customerPayments.get(email.toLowerCase());

    if (!customerPaymentIds || customerPaymentIds.length === 0) {
      logger.info('No payments found for customer', { email });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'history', status: 'no_payments' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(200).json({
        success: true,
        payments: [],
        total: 0
      });
    }

    const customerPaymentsList = customerPaymentIds
      .map(id => payments.get(id))
      .filter(payment => payment !== undefined);

    logger.info('Customer payment history retrieved', { 
      email, 
      paymentCount: customerPaymentsList.length 
    });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'history', status: 'success' },
      (Date.now() - processingStart) / 1000
    );

    res.status(200).json({
      success: true,
      payments: customerPaymentsList,
      total: customerPaymentsList.length
    });
  } catch (error) {
    logger.error('Error retrieving customer payments', { error: error.message, email: req.params.email });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'history', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cancel payment
app.post('/api/payments/:paymentId/cancel', async (req, res) => {
  const processingStart = Date.now();
  
  try {
    concurrentPayments.inc();
    
    const { paymentId } = req.params;
    const payment = payments.get(paymentId);

    if (!payment) {
      logger.warn('Payment not found for cancellation', { paymentId });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'cancel', status: 'not_found' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      logger.warn('Payment cannot be cancelled', { 
        paymentId, 
        currentStatus: payment.status 
      });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'cancel', status: 'invalid_status' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(400).json({
        success: false,
        error: `Cannot cancel payment with status: ${payment.status}`
      });
    }

    // Check if payment is expired
    if (new Date(payment.expiryDate) < new Date()) {
      payment.status = 'expired';
      updatePaymentStatusMetrics();
      
      logger.warn('Attempted to cancel expired payment', { paymentId });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'cancel', status: 'expired' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(400).json({
        success: false,
        error: 'Payment has expired'
      });
    }

    // Cancel payment
    payment.status = 'cancelled';
    payment.cancelledAt = new Date().toISOString();
    
    updatePaymentStatusMetrics();
    
    logger.info('Payment cancelled successfully', { 
      paymentId, 
      customerEmail: payment.email 
    });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'cancel', status: 'success' },
      (Date.now() - processingStart) / 1000
    );

    res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    logger.error('Error cancelling payment', { error: error.message, paymentId: req.params.paymentId });
    
    paymentErrorsTotal.inc({ 
      error_type: 'cancellation_error', 
      currency: 'unknown' 
    });
    paymentProcessingDurationSeconds.observe(
      { operation: 'cancel', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    concurrentPayments.dec();
  }
});

// Complete payment (simulate payment processing)
app.post('/api/payments/:paymentId/complete', async (req, res) => {
  const processingStart = Date.now();
  
  try {
    concurrentPayments.inc();
    
    const { paymentId } = req.params;
    const payment = payments.get(paymentId);

    if (!payment) {
      logger.warn('Payment not found for completion', { paymentId });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'complete', status: 'not_found' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status !== 'pending') {
      logger.warn('Payment cannot be completed', { 
        paymentId, 
        currentStatus: payment.status 
      });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'complete', status: 'invalid_status' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(400).json({
        success: false,
        error: `Cannot complete payment with status: ${payment.status}`
      });
    }

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // Check if payment is expired
    if (new Date(payment.expiryDate) < new Date()) {
      payment.status = 'expired';
      updatePaymentStatusMetrics();
      
      logger.warn('Attempted to complete expired payment', { paymentId });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'complete', status: 'expired' },
        (Date.now() - processingStart) / 1000
      );
      
      return res.status(400).json({
        success: false,
        error: 'Payment has expired'
      });
    }

    // Complete payment (simulate 95% success rate)
    const isSuccess = Math.random() > 0.05;
    
    if (isSuccess) {
      payment.status = 'completed';
      payment.completedAt = new Date().toISOString();
      
      paymentRequestsTotal.inc({ status: 'completed', currency: payment.currency });
      
      logger.info('Payment completed successfully', { 
        paymentId, 
        customerEmail: payment.email,
        amount: payment.amount,
        currency: payment.currency
      });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'complete', status: 'success' },
        (Date.now() - processingStart) / 1000
      );
    } else {
      payment.status = 'failed';
      payment.failedAt = new Date().toISOString();
      payment.failureReason = 'Payment processing failed';
      
      paymentRequestsTotal.inc({ status: 'failed', currency: payment.currency });
      paymentErrorsTotal.inc({ 
        error_type: 'processing_failure', 
        currency: payment.currency 
      });
      
      logger.warn('Payment processing failed', { 
        paymentId, 
        customerEmail: payment.email 
      });
      
      paymentProcessingDurationSeconds.observe(
        { operation: 'complete', status: 'failed' },
        (Date.now() - processingStart) / 1000
      );
    }
    
    updatePaymentStatusMetrics();

    res.status(200).json({
      success: isSuccess,
      payment
    });
  } catch (error) {
    logger.error('Error completing payment', { error: error.message, paymentId: req.params.paymentId });
    
    paymentErrorsTotal.inc({ 
      error_type: 'completion_error', 
      currency: 'unknown' 
    });
    paymentProcessingDurationSeconds.observe(
      { operation: 'complete', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    concurrentPayments.dec();
  }
});

// Currency conversion endpoint
app.post('/api/currency/convert', (req, res) => {
  const processingStart = Date.now();
  
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    if (!amount || isNaN(amount)) {
      paymentValidationFailuresTotal.inc({ validation_type: 'conversion_amount_invalid' });
      
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    if (!fromCurrency || !toCurrency) {
      paymentValidationFailuresTotal.inc({ validation_type: 'conversion_currency_missing' });
      
      return res.status(400).json({
        success: false,
        error: 'Both fromCurrency and toCurrency are required'
      });
    }

    const convertedAmount = convertCurrency(parseFloat(amount), fromCurrency, toCurrency);
    
    logger.info('Currency conversion performed', { 
      amount, 
      fromCurrency, 
      toCurrency, 
      convertedAmount 
    });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'convert', status: 'success' },
      (Date.now() - processingStart) / 1000
    );

    res.status(200).json({
      success: true,
      originalAmount: parseFloat(amount),
      originalCurrency: fromCurrency.toUpperCase(),
      convertedAmount: parseFloat(convertedAmount.toFixed(2)),
      targetCurrency: toCurrency.toUpperCase(),
      rate: CURRENCY_RATES[toCurrency.toUpperCase()] / CURRENCY_RATES[fromCurrency.toUpperCase()]
    });
  } catch (error) {
    logger.error('Error converting currency', { error: error.message });
    
    paymentValidationFailuresTotal.inc({ validation_type: 'conversion_error' });
    paymentProcessingDurationSeconds.observe(
      { operation: 'convert', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get supported currencies
app.get('/api/currencies/supported', (req, res) => {
  res.status(200).json({
    success: true,
    currencies: SUPPORTED_CURRENCIES,
    rates: CURRENCY_RATES
  });
});

// Get payment statistics
app.get('/api/payments/stats', (req, res) => {
  const processingStart = Date.now();
  
  try {
    const stats = {
      total: payments.size,
      byStatus: {},
      byCurrency: {},
      totalAmount: 0,
      averageAmount: 0
    };

    let totalAmount = 0;

    payments.forEach(payment => {
      // Count by status
      stats.byStatus[payment.status] = (stats.byStatus[payment.status] || 0) + 1;
      
      // Count by currency
      stats.byCurrency[payment.currency] = (stats.byCurrency[payment.currency] || 0) + 1;
      
      // Sum amounts
      totalAmount += payment.amount;
    });

    stats.totalAmount = totalAmount;
    stats.averageAmount = payments.size > 0 ? totalAmount / payments.size : 0;
    
    logger.info('Payment statistics retrieved', { totalPayments: stats.total });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'stats', status: 'success' },
      (Date.now() - processingStart) / 1000
    );

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error retrieving payment statistics', { error: error.message });
    
    paymentProcessingDurationSeconds.observe(
      { operation: 'stats', status: 'error' },
      (Date.now() - processingStart) / 1000
    );
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Health check endpoint for OpenShift
app.get('/health', (req, res) => {
  logger.debug('Health check performed');
  res.status(200).json({ status: 'healthy' });
});

// Metrics endpoint for Prometheus scraping
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).end(error.message);
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Payment application started`, { 
    port: PORT, 
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  });
});