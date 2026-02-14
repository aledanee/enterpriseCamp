const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const logger = require('../../shared/services/logger');
const prisma = require('../../db/prisma');

/**
 * Validation schemas for requests
 */

const createRequestSchema = Joi.object({
  user_type_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'User type ID must be a number',
      'number.integer': 'User type ID must be an integer',
      'number.positive': 'User type ID must be a positive number',
      'any.required': 'User type ID is required'
    }),
  data: Joi.object().required()
    .messages({
      'object.base': 'Data must be an object',
      'any.required': 'Data is required'
    })
});

const updateRequestStatusSchema = Joi.object({
  status: Joi.string()
    .valid('approved', 'rejected')
    .required()
    .messages({
      'any.only': 'Status must be either "approved" or "rejected"',
      'any.required': 'Status is required'
    }),
  admin_notes: Joi.string()
    .max(1000)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Admin notes cannot exceed 1000 characters'
    })
});

/**
 * Get active user types for public request form dropdown
 * UC-007 - User Create New Request (Step 1)
 * PUBLIC - No authentication required
 */
const getActiveUserTypes = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userTypes = await prisma.user_types.findMany({
      where: { is_active: true },
      select: {
        id: true,
        type_name: true,
        is_active: true
      },
      orderBy: { type_name: 'asc' }
    });

    if (userTypes.length === 0) {
      const responseTime = Date.now() - startTime;
      
      logger.info('No active user types available for public request', {
        action: 'get_active_user_types_empty',
        response_time_ms: responseTime,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        message: 'No request types available at this time',
        data: {
          user_types: [],
          count: 0
        }
      });
    }

    const responseTime = Date.now() - startTime;

    logger.info('Active user types retrieved for public request', {
      action: 'get_active_user_types',
      count: userTypes.length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        user_types: userTypes,
        count: userTypes.length
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get active user types', {
      action: 'get_active_user_types_failed',
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user types',
      message: 'An error occurred while fetching available request types'
    });
  }
};

/**
 * Get fields for a specific user type (for dynamic form rendering)
 * UC-007 - User Create New Request (Step 2)
 * PUBLIC - No authentication required
 */
const getUserTypeFields = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userTypeId = parseInt(id);

    if (!userTypeId || userTypeId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type ID',
        message: 'User type ID must be a positive integer'
      });
    }

    // Check if user type exists and is active
    const userType = await prisma.user_types.findUnique({
      where: { id: userTypeId },
      select: {
        id: true,
        type_name: true,
        is_active: true
      }
    });

    if (!userType) {
      return res.status(404).json({
        success: false,
        error: 'User type not found',
        message: 'The requested user type does not exist'
      });
    }

    if (!userType.is_active) {
      return res.status(400).json({
        success: false,
        error: 'User type inactive',
        message: 'This user type is currently not accepting requests'
      });
    }

    // Get fields for the user type
    const userTypeFields = await prisma.user_type_fields.findMany({
      where: { user_type_id: userTypeId },
      include: {
        fields_master: true
      },
      orderBy: { field_order: 'asc' }
    });

    const fields = userTypeFields.map(utf => ({
      field_id: utf.fields_master.id,
      field_name: utf.fields_master.field_name,
      field_label: utf.fields_master.field_label,
      field_type: utf.fields_master.field_type,
      field_options: utf.fields_master.field_options,
      is_required: utf.is_required,
      field_order: utf.field_order
    }));

    const responseTime = Date.now() - startTime;

    logger.info('User type fields retrieved for public request', {
      action: 'get_user_type_fields',
      user_type_id: userTypeId,
      type_name: userType.type_name,
      fields_count: fields.length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        user_type: {
          id: userType.id,
          type_name: userType.type_name
        },
        fields: fields,
        count: fields.length
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get user type fields', {
      action: 'get_user_type_fields_failed',
      user_type_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve fields',
      message: 'An error occurred while fetching form fields'
    });
  }
};

/**
 * Create a new request (public submission)
 * UC-007 - User Create New Request
 * PUBLIC - No authentication required
 */
const createRequest = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate base request structure
    const { error, value } = createRequestSchema.validate(req.body);
    if (error) {
      logger.warn('Request creation validation failed', {
        action: 'create_request_validation_failed',
        validation_errors: error.details,
        ip_address: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.reduce((acc, detail) => {
          const field = detail.path.join('.');
          acc[field] = detail.message;
          return acc;
        }, {})
      });
    }

    const { user_type_id, data } = value;

    // Verify user type exists and is active
    const userType = await prisma.user_types.findUnique({
      where: { id: user_type_id },
      select: {
        id: true,
        type_name: true,
        is_active: true
      }
    });

    if (!userType) {
      return res.status(404).json({
        success: false,
        error: 'User type not found',
        message: 'The selected request type does not exist'
      });
    }

    if (!userType.is_active) {
      return res.status(400).json({
        success: false,
        error: 'User type inactive',
        message: 'This request type is currently not accepting submissions'
      });
    }

    // Get required fields for this user type
    const userTypeFields = await prisma.user_type_fields.findMany({
      where: { user_type_id: user_type_id },
      include: {
        fields_master: true
      }
    });

    // Dynamic validation: check required fields are present and valid
    const validationErrors = {};
    
    userTypeFields.forEach(utf => {
      const fieldName = utf.fields_master.field_name;
      const fieldLabel = utf.fields_master.field_label;
      const fieldType = utf.fields_master.field_type;
      const fieldValue = data[fieldName];

      // Check required fields
      if (utf.is_required) {
        if (fieldValue === undefined || fieldValue === null || 
            (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
          validationErrors[fieldName] = `${fieldLabel} is required`;
          return;
        }
      }

      // Type-specific validation (only if value is provided)
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        switch (fieldType) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) {
              validationErrors[fieldName] = 'Invalid email format';
            }
            break;
          case 'tel':
            if (!/^[0-9+\-\s()]+$/.test(fieldValue)) {
              validationErrors[fieldName] = 'Invalid phone number format';
            }
            break;
          case 'number':
            if (isNaN(Number(fieldValue))) {
              validationErrors[fieldName] = 'Must be a valid number';
            }
            break;
          case 'dropdown':
            if (utf.fields_master.field_options) {
              const options = Array.isArray(utf.fields_master.field_options) 
                ? utf.fields_master.field_options 
                : [];
              if (options.length > 0 && !options.includes(fieldValue)) {
                validationErrors[fieldName] = `Invalid option. Must be one of: ${options.join(', ')}`;
              }
            }
            break;
        }
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      logger.warn('Request dynamic validation failed', {
        action: 'create_request_dynamic_validation_failed',
        user_type_id: user_type_id,
        type_name: userType.type_name,
        validation_errors: validationErrors,
        ip_address: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Create the request
    const newRequest = await prisma.requests.create({
      data: {
        user_type_id: user_type_id,
        data: data,
        status: 'pending'
      }
    });

    const responseTime = Date.now() - startTime;

    logger.info('Request created successfully', {
      action: 'create_request_success',
      request_id: newRequest.id,
      user_type_id: user_type_id,
      type_name: userType.type_name,
      data_fields: Object.keys(data),
      ip_address: req.ip || req.connection.remoteAddress,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: {
        request_id: newRequest.id,
        user_type_id: newRequest.user_type_id,
        type_name: userType.type_name,
        status: newRequest.status,
        created_at: newRequest.created_at
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to create request', {
      action: 'create_request_failed',
      input_data: req.body,
      ip_address: req.ip || req.connection.remoteAddress,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to submit request',
      message: 'An error occurred while processing your request'
    });
  }
};

/**
 * Get all requests with filtering, sorting and pagination
 * UC-008 - Admin View and Manage Requests
 * ADMIN - Authentication required
 */
const getRequests = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      status = 'all',
      user_type_id,
      search = '',
      sort = 'created_at',
      order = 'desc',
      page = 1,
      per_page = 25
    } = req.query;

    const pageNum = parseInt(page);
    const perPage = Math.min(parseInt(per_page), 100);
    const offset = (pageNum - 1) * perPage;

    // Build where clause
    const where = {};
    if (status !== 'all') {
      where.status = status;
    }
    if (user_type_id) {
      where.user_type_id = parseInt(user_type_id);
    }

    // Build order by clause
    const orderBy = {};
    if (sort === 'created_at') {
      orderBy.created_at = order;
    } else if (sort === 'status') {
      orderBy.status = order;
    } else if (sort === 'updated_at') {
      orderBy.updated_at = order;
    } else {
      orderBy.created_at = order;
    }

    // Get requests with user type info
    const [requests, totalCount] = await Promise.all([
      prisma.requests.findMany({
        where,
        orderBy,
        skip: offset,
        take: perPage,
        include: {
          user_type: {
            select: {
              id: true,
              type_name: true,
              is_active: true
            }
          }
        }
      }),
      prisma.requests.count({ where })
    ]);

    // Apply search filter on JSONB data (post-query for simplicity)
    let filteredRequests = requests;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRequests = requests.filter(request => {
        const data = request.data || {};
        return Object.values(data).some(value => 
          String(value).toLowerCase().includes(searchLower)
        );
      });
    }

    // Process requests
    const processedRequests = filteredRequests.map(request => ({
      id: request.id,
      user_type_id: request.user_type_id,
      type_name: request.user_type?.type_name || 'Deleted Type',
      data: request.data,
      status: request.status,
      admin_notes: request.admin_notes,
      created_at: request.created_at,
      updated_at: request.updated_at,
      processed_at: request.processed_at
    }));

    // Get status counts
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.requests.count({ where: { status: 'pending' } }),
      prisma.requests.count({ where: { status: 'approved' } }),
      prisma.requests.count({ where: { status: 'rejected' } })
    ]);

    const totalPages = Math.ceil(totalCount / perPage);
    const responseTime = Date.now() - startTime;

    logger.info('Requests retrieved successfully', {
      action: 'get_requests',
      admin_id: req.admin.id,
      filters: { status, user_type_id, search, sort, order },
      pagination: { page: pageNum, per_page: perPage },
      results_count: processedRequests.length,
      total_count: totalCount,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Requests retrieved successfully',
      data: {
        requests: processedRequests,
        metadata: {
          total_count: totalCount,
          page: pageNum,
          per_page: perPage,
          total_pages: totalPages,
          response_time_ms: responseTime
        },
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          total: pendingCount + approvedCount + rejectedCount
        }
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get requests', {
      action: 'get_requests_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve requests',
      message: 'An error occurred while fetching requests data'
    });
  }
};

/**
 * Get single request details
 * UC-008 - Admin View and Manage Requests (Detail View)
 * ADMIN - Authentication required
 */
const getRequest = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const requestId = parseInt(id);

    if (!requestId || requestId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request ID',
        message: 'Request ID must be a positive integer'
      });
    }

    const request = await prisma.requests.findUnique({
      where: { id: requestId },
      include: {
        user_type: {
          include: {
            user_type_fields: {
              include: {
                fields_master: true
              },
              orderBy: { field_order: 'asc' }
            }
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: 'The requested record does not exist'
      });
    }

    // Build detailed field data with labels
    const fieldDetails = request.user_type?.user_type_fields?.map(utf => ({
      field_name: utf.fields_master.field_name,
      field_label: utf.fields_master.field_label,
      field_type: utf.fields_master.field_type,
      is_required: utf.is_required,
      field_order: utf.field_order,
      submitted_value: request.data?.[utf.fields_master.field_name] || null
    })) || [];

    const responseTime = Date.now() - startTime;

    logger.info('Request detail retrieved successfully', {
      action: 'get_request_detail',
      admin_id: req.admin.id,
      request_id: requestId,
      request_status: request.status,
      user_type_id: request.user_type_id,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        request: {
          id: request.id,
          user_type_id: request.user_type_id,
          type_name: request.user_type?.type_name || 'Deleted Type',
          data: request.data,
          status: request.status,
          admin_notes: request.admin_notes,
          created_at: request.created_at,
          updated_at: request.updated_at,
          processed_at: request.processed_at
        },
        field_details: fieldDetails
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get request detail', {
      action: 'get_request_detail_failed',
      admin_id: req.admin?.id,
      request_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve request details',
      message: 'An error occurred while fetching request data'
    });
  }
};

/**
 * Update request status (approve or reject)
 * UC-009 - Admin Approve or Reject Request
 * ADMIN - Authentication required
 */
const updateRequestStatus = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const requestId = parseInt(id);

    if (!requestId || requestId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request ID',
        message: 'Request ID must be a positive integer'
      });
    }

    // Validate request body
    const { error, value } = updateRequestStatusSchema.validate(req.body);
    if (error) {
      logger.warn('Request status update validation failed', {
        action: 'update_request_status_validation_failed',
        admin_id: req.admin.id,
        request_id: requestId,
        validation_errors: error.details,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.reduce((acc, detail) => {
          const field = detail.path.join('.');
          acc[field] = detail.message;
          return acc;
        }, {})
      });
    }

    const { status, admin_notes } = value;

    // Check if request exists
    const existingRequest = await prisma.requests.findUnique({
      where: { id: requestId },
      include: {
        user_type: {
          select: {
            id: true,
            type_name: true
          }
        }
      }
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
        message: 'The request you are trying to process does not exist'
      });
    }

    // Check if request is still pending
    if (existingRequest.status !== 'pending') {
      logger.warn('Attempt to process already processed request', {
        action: 'update_request_status_conflict',
        admin_id: req.admin.id,
        request_id: requestId,
        current_status: existingRequest.status,
        attempted_status: status,
        timestamp: new Date().toISOString()
      });

      return res.status(409).json({
        success: false,
        error: 'Request already processed',
        message: `This request has already been ${existingRequest.status}`,
        data: {
          current_status: existingRequest.status,
          processed_at: existingRequest.processed_at
        }
      });
    }

    // Update request status
    const updatedRequest = await prisma.requests.update({
      where: { id: requestId },
      data: {
        status: status,
        admin_notes: admin_notes || null,
        processed_at: new Date(),
        updated_at: new Date()
      }
    });

    const responseTime = Date.now() - startTime;

    logger.info('Request status updated successfully', {
      action: 'update_request_status_success',
      admin_id: req.admin.id,
      request_id: requestId,
      old_status: 'pending',
      new_status: status,
      admin_notes: admin_notes || null,
      user_type_id: existingRequest.user_type_id,
      type_name: existingRequest.user_type?.type_name,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Request status updated successfully',
      data: {
        request_id: updatedRequest.id,
        old_status: 'pending',
        new_status: updatedRequest.status,
        admin_notes: updatedRequest.admin_notes,
        processed_at: updatedRequest.processed_at,
        updated_at: updatedRequest.updated_at
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to update request status', {
      action: 'update_request_status_failed',
      admin_id: req.admin?.id,
      request_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to update request status',
      message: 'An error occurred while processing the request'
    });
  }
};

module.exports = {
  getActiveUserTypes,
  getUserTypeFields,
  createRequest,
  getRequests,
  getRequest,
  updateRequestStatus
};
