const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Payment generation endpoint
app.post('/api/payments', (req, res) => {
  try {
    const { customerName, amount, currency, description } = req.body;

    // Validate required fields
    if (!customerName || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, amount, currency'
      });
    }

    // Generate payment object
    const payment = {
      paymentId: uuidv4(),
      customerName,
      amount: parseFloat(amount),
      currency,
      description: description || 'No description provided',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    };

    // Log payment generation (in production, this would save to database)
    console.log('Payment generated:', payment);

    res.status(201).json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Error generating payment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Health check endpoint for OpenShift
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Payment application running on port ${PORT}`);
});