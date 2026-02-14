const express = require('express');
const router = express.Router();
const { getFieldsMaster, getFieldDetail } = require('./controllers');
const { authenticateAdmin } = require('../../shared/middleware/auth');
const logger = require('../../shared/services/logger');

// Apply authentication middleware to all fields-master routes
router.use(authenticateAdmin);

// Request logging middleware
const requestLogger = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.info('Fields Master API request', {
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
 *     FieldMasterDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         field_name:
 *           type: string
 *           example: name
 *         field_label:
 *           type: string
 *           example: الاسم الكامل
 *         field_type:
 *           type: string
 *           example: text
 *         field_options:
 *           type: object
 *           nullable: true
 *           example: null
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         usage:
 *           type: object
 *           properties:
 *             total_user_types:
 *               type: integer
 *               example: 3
 *             active_user_types:
 *               type: integer
 *               example: 2
 *             user_types:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user_type_id:
 *                     type: integer
 *                     example: 1
 *                   type_name:
 *                     type: string
 *                     example: student
 *                   is_active:
 *                     type: boolean
 *                     example: true
 *                   is_required:
 *                     type: boolean
 *                     example: true
 *                   field_order:
 *                     type: integer
 *                     example: 1
 */

/**
 * @swagger
 * tags:
 *   name: Fields Master
 *   description: Fields master management endpoints (Admin only). Implements UC-006.
 */

/**
 * @swagger
 * /api/v1/fields-master:
 *   get:
 *     summary: Get all master fields
 *     description: Retrieves a paginated list of all master fields with optional search, filtering by field type, and usage statistics showing which user types use each field. Implements UC-006 - Admin View Fields Master.
 *     tags: [Fields Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search fields by name or label (case-insensitive)
 *         example: email
 *       - in: query
 *         name: field_type
 *         schema:
 *           type: string
 *           enum: [all, text, email, tel, number, dropdown, textarea]
 *           default: all
 *         description: Filter by field type
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [id, name, type, created_at]
 *           default: id
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *         description: Items per page (max 100)
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *           default: usage
 *         description: Comma-separated list of related data to include (usage)
 *     responses:
 *       200:
 *         description: Fields retrieved successfully
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
 *                   example: Fields retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     fields:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FieldMasterDetail'
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         total_count:
 *                           type: integer
 *                           example: 15
 *                         type_breakdown:
 *                           type: object
 *                           example:
 *                             text: 5
 *                             email: 2
 *                             tel: 2
 *                             dropdown: 3
 *                             textarea: 1
 *                             number: 2
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         per_page:
 *                           type: integer
 *                           example: 25
 *                         total_pages:
 *                           type: integer
 *                           example: 1
 *                         response_time_ms:
 *                           type: integer
 *                           example: 45
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
router.get('/', getFieldsMaster);

/**
 * @swagger
 * /api/v1/fields-master/{id}:
 *   get:
 *     summary: Get field details
 *     description: Retrieves detailed information for a specific field including full usage information across all user types. Shows which user types use this field, whether it's required or optional, and its display order. Implements UC-006 - Admin View Fields Master (Detail View).
 *     tags: [Fields Master]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Field ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Field details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     field:
 *                       $ref: '#/components/schemas/FieldMasterDetail'
 *                     usage:
 *                       type: object
 *                       properties:
 *                         total_user_types:
 *                           type: integer
 *                           example: 3
 *                         active_user_types:
 *                           type: integer
 *                           example: 2
 *                         inactive_user_types:
 *                           type: integer
 *                           example: 1
 *                         required_in:
 *                           type: integer
 *                           example: 2
 *                         optional_in:
 *                           type: integer
 *                           example: 1
 *                         user_types:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               user_type_id:
 *                                 type: integer
 *                               type_name:
 *                                 type: string
 *                               is_active:
 *                                 type: boolean
 *                               is_required:
 *                                 type: boolean
 *                               field_order:
 *                                 type: integer
 *       400:
 *         description: Invalid field ID
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
 *         description: Field not found
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
router.get('/:id', getFieldDetail);

// Error handling middleware for fields-master routes
router.use((error, req, res, next) => {
  logger.error('Fields Master API error', {
    action: 'api_error',
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    admin_id: req.admin?.id,
    timestamp: new Date().toISOString()
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details
    });
  }

  if (error.code && error.code.startsWith('23')) {
    return res.status(400).json({
      success: false,
      error: 'Database constraint violation',
      message: 'The operation violates database constraints'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;
