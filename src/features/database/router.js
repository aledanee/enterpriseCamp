const express = require('express');
const router = express.Router();
const {
  createBackup,
  restoreBackup,
  getDatabaseHealth,
  getDatabaseStats,
  getBackups,
  deleteBackup
} = require('./controllers');
const { authenticateAdmin } = require('../../shared/middleware/auth');
const logger = require('../../shared/services/logger');

// Apply authentication middleware to all database routes
router.use(authenticateAdmin);

// Request logging middleware
const requestLogger = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.info('Database API request', {
    action: 'api_request',
    method: req.method,
    path: req.path,
    admin_id: req.admin?.id,
    ip_address: clientIp,
    user_agent: userAgent,
    timestamp: new Date().toISOString()
  });
  
  next();
};

router.use(requestLogger);

/**
 * @swagger
 * components:
 *   schemas:
 *     BackupInfo:
 *       type: object
 *       properties:
 *         filename:
 *           type: string
 *           example: backup_2026-02-14T10-30-00-000Z.sql
 *         file_size_kb:
 *           type: integer
 *           example: 256
 *         created_at:
 *           type: string
 *           format: date-time
 *         modified_at:
 *           type: string
 *           format: date-time
 *     DatabaseHealthInfo:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, warning, unhealthy]
 *           example: healthy
 *         database:
 *           type: object
 *           properties:
 *             version:
 *               type: string
 *               example: PostgreSQL 16.1
 *             name:
 *               type: string
 *               example: lesone_db
 *             size:
 *               type: string
 *               example: 12 MB
 *         connections:
 *           type: object
 *           properties:
 *             active:
 *               type: integer
 *               example: 5
 *             max:
 *               type: integer
 *               example: 100
 *             usage_percentage:
 *               type: number
 *               example: 5.0
 *     DatabaseStatsInfo:
 *       type: object
 *       properties:
 *         tables:
 *           type: object
 *           properties:
 *             user_types:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 active:
 *                   type: integer
 *                 inactive:
 *                   type: integer
 *             requests:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 pending:
 *                   type: integer
 *                 approved:
 *                   type: integer
 *                 rejected:
 *                   type: integer
 *         activity:
 *           type: object
 *           properties:
 *             requests_last_24h:
 *               type: integer
 *             requests_last_7d:
 *               type: integer
 *             requests_last_30d:
 *               type: integer
 *     RestoreConfirmation:
 *       type: object
 *       required:
 *         - confirmed
 *       properties:
 *         confirmed:
 *           type: boolean
 *           description: Must be true to confirm restoration
 *           example: true
 *     DeleteBackupConfirmation:
 *       type: object
 *       required:
 *         - confirmed
 *       properties:
 *         confirmed:
 *           type: boolean
 *           description: Must be true to confirm deletion
 *           example: true
 */

/**
 * @swagger
 * tags:
 *   name: Database
 *   description: Database management endpoints (Admin only). Implements UC-010 through UC-014.
 */

/**
 * @swagger
 * /api/v1/database/health:
 *   get:
 *     summary: Database health check
 *     description: Performs a comprehensive health check on the PostgreSQL database including connectivity, version, size, connections, and table information. Implements UC-012.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database health check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Database is operating normally
 *                 data:
 *                   $ref: '#/components/schemas/DatabaseHealthInfo'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Database is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Database health check failed
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: unhealthy
 *                     error:
 *                       type: string
 */
router.get('/health', getDatabaseHealth);

/**
 * @swagger
 * /api/v1/database/stats:
 *   get:
 *     summary: Get database statistics
 *     description: Retrieves comprehensive database statistics including table record counts, request activity trends, storage information, and requests breakdown by user type. Implements UC-013.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Database statistics retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/DatabaseStatsInfo'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/stats', getDatabaseStats);

/**
 * @swagger
 * /api/v1/database/backups:
 *   get:
 *     summary: List all backup files
 *     description: Retrieves a list of all available database backup files with file sizes, creation dates, and total storage used. Implements UC-014.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backups listed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Backups retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     backups:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BackupInfo'
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         total_backups:
 *                           type: integer
 *                           example: 5
 *                         total_size_kb:
 *                           type: integer
 *                           example: 1280
 *                         total_size_mb:
 *                           type: number
 *                           example: 1.25
 *                         backup_directory:
 *                           type: string
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/backups', getBackups);

/**
 * @swagger
 * /api/v1/database/backup:
 *   post:
 *     summary: Create database backup
 *     description: Creates a full database backup using pg_dump. The backup file is saved in the server's backups directory with a timestamped filename. Implements UC-010.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Backup created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Database backup created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                       example: backup_2026-02-14T10-30-00-000Z.sql
 *                     file_size_kb:
 *                       type: integer
 *                       example: 256
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     backup_path:
 *                       type: string
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Backup creation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/backup', createBackup);

/**
 * @swagger
 * /api/v1/database/restore/{filename}:
 *   post:
 *     summary: Restore database from backup
 *     description: Restores the database from a previously created backup file using psql. Requires explicit confirmation as this operation will overwrite current data. Implements UC-011.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the backup file to restore from
 *         example: backup_2026-02-14T10-30-00-000Z.sql
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RestoreConfirmation'
 *     responses:
 *       200:
 *         description: Database restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Database restored successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     restored_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Restoration not confirmed or invalid filename
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Backup file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Restoration failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/restore/:filename', restoreBackup);

/**
 * @swagger
 * /api/v1/database/backup/{filename}:
 *   delete:
 *     summary: Delete a backup file
 *     description: Permanently deletes a backup file from the server. Requires explicit confirmation. Implements UC-014.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the backup file to delete
 *         example: backup_2026-02-14T10-30-00-000Z.sql
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteBackupConfirmation'
 *     responses:
 *       200:
 *         description: Backup file deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Backup file deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     file_size_kb:
 *                       type: integer
 *                     deleted_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Deletion not confirmed or invalid filename
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Backup file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Deletion failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/backup/:filename', deleteBackup);

// Error handling middleware for database routes
router.use((error, req, res, next) => {
  logger.error('Database API error', {
    action: 'api_error',
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    admin_id: req.admin?.id,
    timestamp: new Date().toISOString()
  });

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;
