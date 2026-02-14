const express = require('express');
const router = express.Router();
const {
  getActiveUserTypes,
  getUserTypeFields,
  createRequest,
  getRequests,
  getRequest,
  updateRequestStatus
} = require('./controllers');
const { authenticateAdmin } = require('../../shared/middleware/auth');
const logger = require('../../shared/services/logger');

// Request logging middleware (for all routes)
const requestLogger = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.info('Requests API request', {
    action: 'api_request',
    method: req.method,
    path: req.path,
    admin_id: req.admin?.id || 'public',
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
 *     RequestItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_type_id:
 *           type: integer
 *           example: 1
 *         type_name:
 *           type: string
 *           example: student
 *         data:
 *           type: object
 *           example:
 *             name: أحمد محمد
 *             email: ahmed@mail.com
 *             phone: "0501234567"
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           example: pending
 *         admin_notes:
 *           type: string
 *           nullable: true
 *           example: null
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         processed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     CreateRequestBody:
 *       type: object
 *       required:
 *         - user_type_id
 *         - data
 *       properties:
 *         user_type_id:
 *           type: integer
 *           description: ID of the selected user type
 *           example: 1
 *         data:
 *           type: object
 *           description: Dynamic form data as key-value pairs
 *           example:
 *             name: أحمد محمد
 *             email: ahmed@mail.com
 *             phone: "0501234567"
 *             student_id: STU001
 *             course: CS
 *     UpdateRequestStatusBody:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [approved, rejected]
 *           description: New status for the request
 *           example: approved
 *         admin_notes:
 *           type: string
 *           description: Optional admin notes or rejection reason
 *           example: تم قبول طلبك
 *     RequestStats:
 *       type: object
 *       properties:
 *         pending:
 *           type: integer
 *           example: 5
 *         approved:
 *           type: integer
 *           example: 20
 *         rejected:
 *           type: integer
 *           example: 3
 *         total:
 *           type: integer
 *           example: 28
 */

/**
 * @swagger
 * tags:
 *   name: Requests
 *   description: Request management endpoints. Public endpoints for submission (UC-007), Admin endpoints for management (UC-008, UC-009).
 */

// ========================
// PUBLIC ROUTES (No Auth)
// ========================

/**
 * @swagger
 * /api/v1/requests/user-types:
 *   get:
 *     summary: Get active user types for request form
 *     description: Retrieves all active user types for the public request creation dropdown. No authentication required. Implements UC-007 Step 1.
 *     tags: [Requests]
 *     responses:
 *       200:
 *         description: Active user types retrieved successfully
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
 *                     user_types:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           type_name:
 *                             type: string
 *                             example: student
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                     count:
 *                       type: integer
 *                       example: 3
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/user-types', getActiveUserTypes);

/**
 * @swagger
 * /api/v1/requests/user-types/{id}/fields:
 *   get:
 *     summary: Get fields for a user type
 *     description: Retrieves the dynamic form fields for a specific user type. Used to render the request form after user type selection. No authentication required. Implements UC-007 Step 2.
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: User type ID
 *         example: 1
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_type:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         type_name:
 *                           type: string
 *                     fields:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           field_id:
 *                             type: integer
 *                           field_name:
 *                             type: string
 *                           field_label:
 *                             type: string
 *                           field_type:
 *                             type: string
 *                           field_options:
 *                             type: object
 *                             nullable: true
 *                           is_required:
 *                             type: boolean
 *                           field_order:
 *                             type: integer
 *                     count:
 *                       type: integer
 *       400:
 *         description: Invalid user type ID or inactive user type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User type not found
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
router.get('/user-types/:id/fields', getUserTypeFields);

/**
 * @swagger
 * /api/v1/requests:
 *   post:
 *     summary: Submit a new request
 *     description: Creates a new request with dynamic form data. No authentication required. Validates required fields based on the selected user type configuration. Data is stored as JSONB with status set to "pending". Implements UC-007.
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRequestBody'
 *           example:
 *             user_type_id: 1
 *             data:
 *               name: أحمد محمد
 *               email: ahmed@mail.com
 *               phone: "0501234567"
 *               student_id: STU001
 *               course: CS
 *     responses:
 *       201:
 *         description: Request submitted successfully
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
 *                   example: Request submitted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: integer
 *                       example: 1
 *                     user_type_id:
 *                       type: integer
 *                       example: 1
 *                     type_name:
 *                       type: string
 *                       example: student
 *                     status:
 *                       type: string
 *                       example: pending
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation failed - missing required fields or invalid data
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
 *                   example: Validation failed
 *                 details:
 *                   type: object
 *                   example:
 *                     email: Invalid email format
 *                     student_id: الرقم الجامعي is required
 *       404:
 *         description: User type not found
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
router.post('/', createRequest);

// ========================
// ADMIN ROUTES (Auth Required)
// ========================

/**
 * @swagger
 * /api/v1/requests/admin:
 *   get:
 *     summary: Get all requests (Admin)
 *     description: Retrieves a paginated list of all requests with filtering by status, user type, and search functionality. Admin authentication required. Implements UC-008.
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, approved, rejected]
 *           default: all
 *         description: Filter by request status
 *       - in: query
 *         name: user_type_id
 *         schema:
 *           type: integer
 *         description: Filter by user type ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across request data fields (name, email, etc.)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, status, updated_at]
 *           default: created_at
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
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
 *     responses:
 *       200:
 *         description: Requests retrieved successfully
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
 *                   example: Requests retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RequestItem'
 *                     metadata:
 *                       $ref: '#/components/schemas/PaginationMetadata'
 *                     stats:
 *                       $ref: '#/components/schemas/RequestStats'
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
router.get('/admin', authenticateAdmin, getRequests);

/**
 * @swagger
 * /api/v1/requests/admin/{id}:
 *   get:
 *     summary: Get request details (Admin)
 *     description: Retrieves detailed information for a specific request including all submitted field data with labels, user type information, and processing status. Admin authentication required. Implements UC-008 Detail View.
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Request ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Request details retrieved successfully
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
 *                     request:
 *                       $ref: '#/components/schemas/RequestItem'
 *                     field_details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           field_name:
 *                             type: string
 *                             example: name
 *                           field_label:
 *                             type: string
 *                             example: الاسم الكامل
 *                           field_type:
 *                             type: string
 *                             example: text
 *                           is_required:
 *                             type: boolean
 *                             example: true
 *                           field_order:
 *                             type: integer
 *                             example: 1
 *                           submitted_value:
 *                             type: string
 *                             example: أحمد محمد
 *       400:
 *         description: Invalid request ID
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
 *         description: Request not found
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
router.get('/admin/:id', authenticateAdmin, getRequest);

/**
 * @swagger
 * /api/v1/requests/admin/{id}/status:
 *   put:
 *     summary: Approve or reject a request (Admin)
 *     description: Updates a pending request's status to approved or rejected. Only pending requests can be processed. Admin can optionally add notes. Implements UC-009.
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Request ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRequestStatusBody'
 *           examples:
 *             approve:
 *               summary: Approve request
 *               value:
 *                 status: approved
 *                 admin_notes: تم قبول طلبك للتسجيل
 *             reject:
 *               summary: Reject request
 *               value:
 *                 status: rejected
 *                 admin_notes: بيانات ناقصة، يرجى إعادة التقديم
 *     responses:
 *       200:
 *         description: Request status updated successfully
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
 *                   example: Request status updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     request_id:
 *                       type: integer
 *                       example: 1
 *                     old_status:
 *                       type: string
 *                       example: pending
 *                     new_status:
 *                       type: string
 *                       example: approved
 *                     admin_notes:
 *                       type: string
 *                       example: تم قبول طلبك للتسجيل
 *                     processed_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation failed
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
 *         description: Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Request already processed
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
 *                   example: Request already processed
 *                 message:
 *                   type: string
 *                   example: This request has already been approved
 *                 data:
 *                   type: object
 *                   properties:
 *                     current_status:
 *                       type: string
 *                       example: approved
 *                     processed_at:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/admin/:id/status', authenticateAdmin, updateRequestStatus);

// Error handling middleware for requests routes
router.use((error, req, res, next) => {
  logger.error('Requests API error', {
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
