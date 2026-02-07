const express = require('express');
const router = express.Router();
const { 
  getUserTypes, 
  getUserType, 
  createUserType, 
  updateUserType, 
  deleteUserType,
  updateUserTypeStatus,
  getUserTypeDeleteInfo,
  getFieldsMaster
} = require('./controllers');
const { authenticateAdmin } = require('../../shared/middleware/auth');
const logger = require('../../shared/services/logger');

// Apply authentication middleware to all user-types routes
router.use(authenticateAdmin);

// Request logging middleware
const requestLogger = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  logger.info('User Types API request', {
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
 *     UserType:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         type_name:
 *           type: string
 *           example: student
 *         is_active:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: 2026-02-07T10:00:00.000Z
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: 2026-02-07T10:00:00.000Z
 *     UserTypeField:
 *       type: object
 *       properties:
 *         field_id:
 *           type: integer
 *           example: 1
 *         field_name:
 *           type: string
 *           example: first_name
 *         field_label:
 *           type: string
 *           example: First Name
 *         field_type:
 *           type: string
 *           example: text
 *         field_options:
 *           type: object
 *           nullable: true
 *           example: null
 *         is_required:
 *           type: boolean
 *           example: true
 *         field_order:
 *           type: integer
 *           example: 1
 *     FieldMaster:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         field_name:
 *           type: string
 *           example: first_name
 *         field_label:
 *           type: string
 *           example: First Name
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
 *     CreateUserTypeRequest:
 *       type: object
 *       required:
 *         - type_name
 *         - selectedFields
 *       properties:
 *         type_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           pattern: '^[a-zA-Z0-9_]+$'
 *           description: Unique user type name (letters, numbers, underscores only)
 *           example: contractor
 *         selectedFields:
 *           type: array
 *           minItems: 1
 *           description: Fields to associate with this user type
 *           items:
 *             type: object
 *             required:
 *               - field_id
 *               - is_required
 *               - field_order
 *             properties:
 *               field_id:
 *                 type: integer
 *                 description: ID from fields_master table
 *                 example: 1
 *               is_required:
 *                 type: boolean
 *                 description: Whether this field is mandatory
 *                 example: true
 *               field_order:
 *                 type: integer
 *                 description: Display order of the field (must be unique)
 *                 example: 1
 *     UpdateUserTypeRequest:
 *       type: object
 *       required:
 *         - type_name
 *         - selectedFields
 *       properties:
 *         type_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           pattern: '^[a-zA-Z0-9_]+$'
 *           description: Updated user type name
 *           example: contractor_v2
 *         selectedFields:
 *           type: array
 *           minItems: 1
 *           description: Updated fields configuration
 *           items:
 *             type: object
 *             required:
 *               - field_id
 *               - is_required
 *               - field_order
 *             properties:
 *               field_id:
 *                 type: integer
 *                 example: 1
 *               is_required:
 *                 type: boolean
 *                 example: true
 *               field_order:
 *                 type: integer
 *                 example: 1
 *     UpdateStatusRequest:
 *       type: object
 *       required:
 *         - is_active
 *       properties:
 *         is_active:
 *           type: boolean
 *           description: New status for the user type
 *           example: false
 *     DeleteUserTypeRequest:
 *       type: object
 *       required:
 *         - confirmed
 *       properties:
 *         confirmed:
 *           type: boolean
 *           description: Must be true to confirm deletion
 *           example: true
 *         force_delete:
 *           type: boolean
 *           description: Force deletion even with recent activity
 *           example: false
 *     UsageStatistics:
 *       type: object
 *       properties:
 *         total_requests:
 *           type: integer
 *           example: 25
 *         active_requests:
 *           type: integer
 *           example: 3
 *         recent_requests_24h:
 *           type: integer
 *           example: 2
 *         last_request_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: 2026-02-07T08:00:00.000Z
 *     SafetyCheck:
 *       type: object
 *       properties:
 *         is_last_user_type:
 *           type: boolean
 *           example: false
 *         has_recent_activity:
 *           type: boolean
 *           example: true
 *         concurrent_edits:
 *           type: boolean
 *           example: false
 *     PaginationMetadata:
 *       type: object
 *       properties:
 *         total_count:
 *           type: integer
 *           example: 10
 *         active_count:
 *           type: integer
 *           example: 8
 *         inactive_count:
 *           type: integer
 *           example: 2
 *         page:
 *           type: integer
 *           example: 1
 *         per_page:
 *           type: integer
 *           example: 25
 *         total_pages:
 *           type: integer
 *           example: 1
 *         response_time_ms:
 *           type: integer
 *           example: 45
 */

/**
 * @swagger
 * tags:
 *   name: User Types
 *   description: User type management endpoints (Admin only). Implements UC-002 through UC-005.
 */

/**
 * @swagger
 * /api/v1/user-types:
 *   get:
 *     summary: Get all user types
 *     description: Retrieves a paginated list of user types with optional filtering by search term, status, and sorting. Supports including field details and usage statistics. Implements UC-005 - Admin View User Types.
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search user types by name (case-insensitive)
 *         example: student
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive]
 *           default: all
 *         description: Filter by active/inactive status
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, created_at]
 *           default: name
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
 *           default: fields,stats
 *         description: Comma-separated list of related data to include (fields, stats)
 *     responses:
 *       200:
 *         description: User types retrieved successfully
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
 *                         $ref: '#/components/schemas/UserType'
 *                     metadata:
 *                       $ref: '#/components/schemas/PaginationMetadata'
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
router.get('/', getUserTypes);

/**
 * @swagger
 * /api/v1/user-types/fields-master:
 *   get:
 *     summary: Get all available fields
 *     description: Retrieves all available fields from the fields_master table that can be assigned to user types. Used during user type creation (UC-002) and editing (UC-003).
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
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
 *                     fields:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FieldMaster'
 *                     count:
 *                       type: integer
 *                       example: 15
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No fields available in the system
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
 *                   example: No fields available
 *                 message:
 *                   type: string
 *                   example: No fields available. Please contact system administrator
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/fields-master', getFieldsMaster);

/**
 * @swagger
 * /api/v1/user-types/{id}:
 *   get:
 *     summary: Get user type details
 *     description: Retrieves detailed information for a specific user type including its fields configuration, usage analytics, and recent activity. Implements UC-005 - Admin View User Types (Detailed View).
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
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
 *         description: User type details retrieved successfully
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
 *                       $ref: '#/components/schemas/UserType'
 *                     fields:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserTypeField'
 *                     usage_analytics:
 *                       type: object
 *                       properties:
 *                         total_requests:
 *                           type: integer
 *                           example: 25
 *                         status_breakdown:
 *                           type: object
 *                           properties:
 *                             pending:
 *                               type: integer
 *                               example: 3
 *                             approved:
 *                               type: integer
 *                               example: 18
 *                             rejected:
 *                               type: integer
 *                               example: 4
 *                         recent_activity:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               request_id:
 *                                 type: integer
 *                               created_at:
 *                                 type: string
 *                                 format: date-time
 *                               status:
 *                                 type: string
 *                         usage_trend:
 *                           type: object
 *                           properties:
 *                             this_week:
 *                               type: integer
 *                               example: 5
 *                             this_month:
 *                               type: integer
 *                               example: 12
 *       400:
 *         description: Invalid user type ID
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
router.get('/:id', getUserType);

/**
 * @swagger
 * /api/v1/user-types/{id}/delete-info:
 *   get:
 *     summary: Get deletion impact information
 *     description: Retrieves impact analysis before deleting a user type, including usage statistics, active requests count, and safety checks. Used as a pre-deletion step in UC-004 - Admin Delete User Type.
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
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
 *         description: Deletion impact information retrieved successfully
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
 *                           example: 1
 *                         type_name:
 *                           type: string
 *                           example: student
 *                         is_active:
 *                           type: boolean
 *                           example: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                     usage_statistics:
 *                       $ref: '#/components/schemas/UsageStatistics'
 *                     safety_check:
 *                       $ref: '#/components/schemas/SafetyCheck'
 *       400:
 *         description: Invalid user type ID
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
router.get('/:id/delete-info', getUserTypeDeleteInfo);

/**
 * @swagger
 * /api/v1/user-types:
 *   post:
 *     summary: Create a new user type
 *     description: Creates a new user type with selected fields from the fields_master table. Validates for duplicate names, valid field IDs, and unique field orders. Implements UC-002 - Admin Create User Type.
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserTypeRequest'
 *           example:
 *             type_name: contractor
 *             selectedFields:
 *               - field_id: 1
 *                 is_required: true
 *                 field_order: 1
 *               - field_id: 2
 *                 is_required: true
 *                 field_order: 2
 *               - field_id: 5
 *                 is_required: false
 *                 field_order: 3
 *     responses:
 *       201:
 *         description: User type created successfully
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
 *                   example: User type created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_type_id:
 *                       type: integer
 *                       example: 3
 *                     type_name:
 *                       type: string
 *                       example: contractor
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     fields_count:
 *                       type: integer
 *                       example: 3
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation failed - duplicate name, invalid fields, or missing required data
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
 *                     type_name: User type name already exists
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
router.post('/', createUserType);

/**
 * @swagger
 * /api/v1/user-types/{id}:
 *   put:
 *     summary: Update an existing user type
 *     description: Updates a user type's name and field configuration. Replaces all existing field associations with the new set. Validates for duplicate names and unique field orders. Implements UC-003 - Admin Edit User Type.
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: User type ID to update
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserTypeRequest'
 *     responses:
 *       200:
 *         description: User type updated successfully
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
 *                   example: User type updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_type_id:
 *                       type: integer
 *                       example: 1
 *                     type_name:
 *                       type: string
 *                       example: contractor_v2
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     fields_count:
 *                       type: integer
 *                       example: 4
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     changes:
 *                       type: object
 *                       properties:
 *                         name_changed:
 *                           type: boolean
 *                           example: true
 *                         fields_added:
 *                           type: integer
 *                           example: 1
 *                         fields_removed:
 *                           type: integer
 *                           example: 0
 *                         requirements_changed:
 *                           type: integer
 *                           example: 1
 *       400:
 *         description: Validation failed - invalid ID, duplicate name, or invalid fields
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
router.put('/:id', updateUserType);

/**
 * @swagger
 * /api/v1/user-types/{id}/status:
 *   put:
 *     summary: Toggle user type status
 *     description: Activates or deactivates a user type. Prevents deactivating the last active user type to ensure system has at least one active type. Implements UC-005 - Admin View User Types (Status Toggle).
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: User type ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStatusRequest'
 *     responses:
 *       200:
 *         description: Status updated successfully
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
 *                   example: User type deactivated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_type_id:
 *                       type: integer
 *                       example: 1
 *                     type_name:
 *                       type: string
 *                       example: student
 *                     is_active:
 *                       type: boolean
 *                       example: false
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid status value or cannot deactivate last user type
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
 *                   example: Cannot deactivate last user type
 *                 message:
 *                   type: string
 *                   example: System requires at least one active user type
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
router.put('/:id/status', updateUserTypeStatus);

/**
 * @swagger
 * /api/v1/user-types/{id}:
 *   delete:
 *     summary: Delete a user type
 *     description: Soft-deletes a user type by deactivating it and removing field associations. Requires explicit confirmation. Prevents deleting the last active user type. Preserves existing request history. Implements UC-004 - Admin Delete User Type.
 *     tags: [User Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: User type ID to delete
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteUserTypeRequest'
 *     responses:
 *       200:
 *         description: User type deleted successfully
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
 *                   example: User type deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_type_id:
 *                       type: integer
 *                       example: 2
 *                     type_name:
 *                       type: string
 *                       example: contractor
 *                     deletion_type:
 *                       type: string
 *                       example: soft_delete
 *                     affected_requests:
 *                       type: integer
 *                       example: 5
 *                     deleted_at:
 *                       type: string
 *                       format: date-time
 *                 summary:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       example: deactivated
 *                     reason:
 *                       type: string
 *                       example: preserve_request_history
 *                     existing_requests_preserved:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Deletion not confirmed, invalid ID, or cannot delete last user type
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
 *                   example: Cannot delete last user type
 *                 details:
 *                   type: object
 *                   properties:
 *                     reason:
 *                       type: string
 *                       example: system_requires_minimum_one_type
 *                     suggestion:
 *                       type: string
 *                       example: Create another user type before deleting this one
 *       401:
 *         description: Unauthorized - invalid or missing token
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
router.delete('/:id', deleteUserType);

// Error handling middleware for user-types routes
router.use((error, req, res, next) => {
  logger.error('User Types API error', {
    action: 'api_error',
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    admin_id: req.admin?.id,
    timestamp: new Date().toISOString()
  });

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details
    });
  }

  // Handle database errors
  if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint errors
    return res.status(400).json({
      success: false,
      error: 'Database constraint violation',
      message: 'The operation violates database constraints'
    });
  }

  // Generic server error
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = router;