const express = require('express');
const router = express.Router();
const prisma = require('../../db/prisma');

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Server health check
 *     description: Returns the current health status of the server
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * @swagger
 * /api/v1/health/db:
 *   get:
 *     summary: Database health check
 *     description: Checks the database connection status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database connection is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DatabaseHealthResponse'
 *       503:
 *         description: Database connection failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/health/db', async (req, res) => {
  try {
    // Attempt a simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      success: true,
      message: 'Database connection is healthy',
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service unavailable',
    });
  }
});

module.exports = router;
