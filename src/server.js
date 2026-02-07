require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./shared/config/swagger');

const config = require('./shared/config');
const logger = require('./shared/services/logger');
const indexRouterV1 = require('./indexRouterV1');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", `http://localhost:${process.env.PORT || 3220}`],
    },
  },
}));
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'LesOne API Docs',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API routes
app.use('/api/v1', indexRouterV1);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'LesOne API Server',
    version: '1.0.0',
    docs: '/api-docs',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(err.status || 500).json({
    success: false,
    message: config.env === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`, {
    environment: config.env,
    port: PORT,
  });
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`� Swagger docs: http://localhost:${PORT}/api-docs`);
  console.log(`�📊 Health check: http://localhost:${PORT}/api/v1/health`);
  console.log(`🗄️  Database health: http://localhost:${PORT}/api/v1/health/db`);
});

module.exports = app;
