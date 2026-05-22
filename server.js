const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const winston = require('winston');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 8080;

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

// Define custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const paymentRequestsTotal = new client.Counter({
  name: 'payment_requests_total',
  help: 'Total number of payment requests',
  labelNames: ['status'],
  registers: [register]
});

const paymentAmountTotal = new client.Gauge({
  name: 'payment_amount_total',
  help: 'Total amount of all payments',
  labelNames: ['currency'],
  registers: [register]
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

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
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route ? req.route.path : req.path,
        status_code: res.statusCode
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
app.post('/api/payments', (req, res) => {
  const startTime = Date.now();
  
  try {
    const { customerName, email, amount, currency, description } = req.body;

    logger.info('Payment request received', { 
      customerName, 
      email,
      amount, 
      currency,
      ip: req.ip 
    });

    // Validate required fields
    if (!customerName || !amount || !currency) {
      logger.warn('Payment validation failed', { 
        missingFields: { 
          customerName: !customerName, 
          amount: !amount, 
          currency: !currency 
        } 
      });
      
      paymentRequestsTotal.inc({ status: 'validation_failed' });
      
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, amount, currency'
      });
    }

    // Generate payment object
    const payment = {
      paymentId: uuidv4(),
      customerName,
      email: email || null,
      amount: parseFloat(amount),
      currency,
      description: description || 'No description provided',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    };

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
    paymentRequestsTotal.inc({ status: 'success' });
    paymentAmountTotal.inc({ 
      currency: payment.currency 
    }, payment.amount);

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
    
    paymentRequestsTotal.inc({ status: 'error' });
    
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