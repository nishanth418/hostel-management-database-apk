require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { verifyDatabase, getHealthStatus } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Root & Health check endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Hostel Management Mobile Backend',
    version: '1.0.0',
    healthCheck: '/api/health'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 500;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

// Mount Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/students', require('./routes/students'));
app.use('/api/hostels', require('./routes/hostels'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/room-types', require('./routes/roomTypes'));
app.use('/api/wardens', require('./routes/wardens'));
app.use('/api/mess', require('./routes/mess'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/procurements', require('./routes/procurements'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/query', require('./routes/query'));
app.use('/api/tables', require('./routes/tables'));

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' not found.`
  });
});

// Central Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`==================================================`);
    console.log(` Hostel Management Mobile Cloud Backend running`);
    console.log(` Port: ${PORT}`);
    console.log(` Health Endpoint: http://localhost:${PORT}/api/health`);
    console.log(`==================================================`);
    await verifyDatabase();
  });
}

module.exports = app;
