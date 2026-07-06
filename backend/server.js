const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import database client
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

const financeRoutes = require('./routes/financeRoutes');
app.use('/api/finance', financeRoutes);

// API Health Check Route
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      status: 'UP',
      database: 'CONNECTED',
      time: result.rows[0].now,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: error.message
    });
  }
});

// Serve static frontend assets & views
app.use(express.static(path.join(__dirname, '../public')));
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/users', express.static(path.join(__dirname, '../users')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/finance', express.static(path.join(__dirname, '../finance')));

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
