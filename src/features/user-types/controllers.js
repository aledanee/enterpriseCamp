const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const logger = require('../../shared/services/logger');
const prisma = require('../../db/prisma');

/**
 * Validation schemas for user types
 */

const createUserTypeSchema = Joi.object({
  type_name: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'User type name can only contain letters, numbers, and underscores',
      'string.min': 'User type name must be at least 2 characters long',
      'string.max': 'User type name cannot exceed 50 characters'
    }),
  selectedFields: Joi.array()
    .items(Joi.object({
      field_id: Joi.number().integer().positive().required(),
      is_required: Joi.boolean().required(),
      field_order: Joi.number().integer().positive().required()
    }))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one field must be selected'
    })
});

const updateUserTypeSchema = createUserTypeSchema;

/**
 * Get all user types with optional filtering and pagination
 * UC-005 - Admin View User Types
 */
const getUserTypes = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      search = '',
      status = 'all',
      sort = 'name',
      order = 'asc',
      page = 1,
      per_page = 25,
      include = 'fields,stats'
    } = req.query;

    const pageNum = parseInt(page);
    const perPage = Math.min(parseInt(per_page), 100); // Max 100 per page
    const offset = (pageNum - 1) * perPage;

    // Build where clause
    const where = {};
    if (search) {
      where.type_name = {
        contains: search,
        mode: 'insensitive'
      };
    }
    if (status !== 'all') {
      where.is_active = status === 'active';
    }

    // Build order by clause
    const orderBy = {};
    if (sort === 'name') {
      orderBy.type_name = order;
    } else if (sort === 'created_at') {
      orderBy.created_at = order;
    }

    // Get user types with counts
    const [userTypes, totalCount] = await Promise.all([
      prisma.user_types.findMany({
        where,
        orderBy,
        skip: offset,
        take: perPage,
        include: {
          user_type_fields: include.includes('fields') ? {
            include: {
              fields_master: true
            },
            orderBy: {
              field_order: 'asc'
            }
          } : false,
          requests: include.includes('stats') ? {
            select: {
              id: true,
              status: true,
              created_at: true
            }
          } : false
        }
      }),
      prisma.user_types.count({ where })
    ]);

    // Process statistics if requested
    const processedUserTypes = userTypes.map(userType => {
      const result = {
        id: userType.id,
        type_name: userType.type_name,
        is_active: userType.is_active,
        created_at: userType.created_at,
        updated_at: userType.updated_at
      };

      if (include.includes('fields')) {
        result.fields_count = userType.user_type_fields?.length || 0;
        result.fields = userType.user_type_fields?.map(utf => ({
          field_id: utf.field_id,
          field_name: utf.fields_master.field_name,
          field_label: utf.fields_master.field_label,
          field_type: utf.fields_master.field_type,
          is_required: utf.is_required,
          field_order: utf.field_order
        })) || [];
      }

      if (include.includes('stats')) {
        const requests = userType.requests || [];
        result.usage_stats = {
          total_requests: requests.length,
          active_requests: requests.filter(r => r.status === 'pending').length,
          completed_requests: requests.filter(r => r.status === 'approved').length,
          rejected_requests: requests.filter(r => r.status === 'rejected').length,
          last_used: requests.length > 0 ? 
            Math.max(...requests.map(r => new Date(r.created_at).getTime())) : null
        };
        
        if (result.usage_stats.last_used) {
          result.usage_stats.last_used = new Date(result.usage_stats.last_used).toISOString();
        }
      }

      return result;
    });

    const totalPages = Math.ceil(totalCount / perPage);
    const activeCount = await prisma.user_types.count({ where: { is_active: true } });
    const inactiveCount = await prisma.user_types.count({ where: { is_active: false } });

    const responseTime = Date.now() - startTime;

    logger.info('User types retrieved successfully', {
      action: 'get_user_types',
      admin_id: req.admin.id,
      filters: { search, status, sort, order },
      pagination: { page: pageNum, per_page: perPage },
      results_count: processedUserTypes.length,
      total_count: totalCount,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        user_types: processedUserTypes,
        metadata: {
          total_count: totalCount,
          active_count: activeCount,
          inactive_count: inactiveCount,
          page: pageNum,
          per_page: perPage,
          total_pages: totalPages,
          response_time_ms: responseTime
        }
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get user types', {
      action: 'get_user_types_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user types',
      message: 'An error occurred while fetching user types data'
    });
  }
};

/**
 * Get specific user type with detailed information
 * UC-005 - Admin View User Types (Detailed View)
 */
const getUserType = async (req, res) => {
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

    const userType = await prisma.user_types.findUnique({
      where: { id: userTypeId },
      include: {
        user_type_fields: {
          include: {
            fields_master: true
          },
          orderBy: {
            field_order: 'asc'
          }
        },
        requests: {
          select: {
            id: true,
            status: true,
            created_at: true
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 10
        }
      }
    });

    if (!userType) {
      logger.warn('User type not found', {
        action: 'get_user_type_not_found',
        admin_id: req.admin.id,
        user_type_id: userTypeId,
        timestamp: new Date().toISOString()
      });

      return res.status(404).json({
        success: false,
        error: 'User type not found',
        message: 'The requested user type does not exist'
      });
    }

    // Process statistics
    const requests = userType.requests || [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const usage_analytics = {
      total_requests: requests.length,
      status_breakdown: {
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length
      },
      recent_activity: requests.slice(0, 5).map(r => ({
        request_id: r.id,
        created_at: r.created_at,
        status: r.status
      })),
      usage_trend: {
        this_week: requests.filter(r => new Date(r.created_at) >= weekAgo).length,
        this_month: requests.filter(r => new Date(r.created_at) >= monthAgo).length
      }
    };

    const responseData = {
      user_type: {
        id: userType.id,
        type_name: userType.type_name,
        is_active: userType.is_active,
        created_at: userType.created_at,
        updated_at: userType.updated_at
      },
      fields: userType.user_type_fields.map(utf => ({
        field_id: utf.field_id,
        field_name: utf.fields_master.field_name,
        field_label: utf.fields_master.field_label,
        field_type: utf.fields_master.field_type,
        field_options: utf.fields_master.field_options,
        is_required: utf.is_required,
        field_order: utf.field_order
      })),
      usage_analytics
    };

    const responseTime = Date.now() - startTime;

    logger.info('User type details retrieved', {
      action: 'get_user_type_details',
      admin_id: req.admin.id,
      user_type_id: userTypeId,
      user_type_name: userType.type_name,
      fields_count: userType.user_type_fields.length,
      requests_count: requests.length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get user type details', {
      action: 'get_user_type_failed',
      admin_id: req.admin?.id,
      user_type_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve user type details',
      message: 'An error occurred while fetching user type information'
    });
  }
};

/**
 * Get all available fields from fields_master table
 * UC-002 - Admin Create User Type (Step 2)
 */
const getFieldsMaster = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const fields = await prisma.fields_master.findMany({
      orderBy: {
        field_name: 'asc'
      }
    });

    if (fields.length === 0) {
      logger.warn('Fields master table is empty', {
        action: 'get_fields_master_empty',
        admin_id: req.admin.id,
        timestamp: new Date().toISOString()
      });

      return res.status(404).json({
        success: false,
        error: 'No fields available',
        message: 'No fields available. Please contact system administrator'
      });
    }

    const responseTime = Date.now() - startTime;

    logger.info('Fields master retrieved', {
      action: 'get_fields_master',
      admin_id: req.admin.id,
      fields_count: fields.length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        fields,
        count: fields.length
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get fields master', {
      action: 'get_fields_master_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve available fields',
      message: 'An error occurred while fetching available fields'
    });
  }
};

/**
 * Create new user type with selected fields
 * UC-002 - Admin Create User Type
 */
const createUserType = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate request body
    const { error, value } = createUserTypeSchema.validate(req.body);
    if (error) {
      logger.warn('User type creation validation failed', {
        action: 'create_user_type_validation_failed',
        admin_id: req.admin.id,
        validation_errors: error.details,
        input_data: req.body,
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

    const { type_name, selectedFields } = value;

    // Check for duplicate name
    const existingUserType = await prisma.user_types.findFirst({
      where: {
        type_name: {
          equals: type_name,
          mode: 'insensitive'
        }
      }
    });

    if (existingUserType) {
      logger.warn('User type creation failed - duplicate name', {
        action: 'create_user_type_duplicate',
        admin_id: req.admin.id,
        type_name: type_name,
        existing_id: existingUserType.id,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: {
          type_name: 'User type name already exists'
        }
      });
    }

    // Validate field orders are unique
    const fieldOrders = selectedFields.map(f => f.field_order);
    const uniqueOrders = new Set(fieldOrders);
    if (fieldOrders.length !== uniqueOrders.size) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: {
          selectedFields: 'Field orders must be unique positive numbers'
        }
      });
    }

    // Validate field IDs exist
    const fieldIds = selectedFields.map(f => f.field_id);
    const validFields = await prisma.fields_master.findMany({
      where: {
        id: { in: fieldIds }
      }
    });

    if (validFields.length !== fieldIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: {
          selectedFields: 'One or more selected fields do not exist'
        }
      });
    }

    // Create user type and field associations in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user type
      const newUserType = await tx.user_types.create({
        data: {
          type_name: type_name,
          is_active: true
        }
      });

      // Create field associations
      const fieldAssociations = selectedFields.map(field => ({
        user_type_id: newUserType.id,
        field_id: field.field_id,
        is_required: field.is_required,
        field_order: field.field_order
      }));

      await tx.user_type_fields.createMany({
        data: fieldAssociations
      });

      return newUserType;
    });

    const responseTime = Date.now() - startTime;

    logger.info('User type created successfully', {
      action: 'create_user_type_success',
      admin_id: req.admin.id,
      user_type_id: result.id,
      type_name: result.type_name,
      fields_count: selectedFields.length,
      required_fields: selectedFields.filter(f => f.is_required).length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'User type created successfully',
      data: {
        user_type_id: result.id,
        type_name: result.type_name,
        is_active: result.is_active,
        fields_count: selectedFields.length,
        created_at: result.created_at
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to create user type', {
      action: 'create_user_type_failed',
      admin_id: req.admin?.id,
      input_data: req.body,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to create user type',
      message: 'An error occurred while creating the user type'
    });
  }
};

/**
 * Update existing user type
 * UC-003 - Admin Edit User Type
 */
const updateUserType = async (req, res) => {
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

    // Validate request body
    const { error, value } = updateUserTypeSchema.validate(req.body);
    if (error) {
      logger.warn('User type update validation failed', {
        action: 'update_user_type_validation_failed',
        admin_id: req.admin.id,
        user_type_id: userTypeId,
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

    const { type_name, selectedFields } = value;

    // Check if user type exists
    const existingUserType = await prisma.user_types.findUnique({
      where: { id: userTypeId },
      include: {
        user_type_fields: true
      }
    });

    if (!existingUserType) {
      return res.status(404).json({
        success: false,
        error: 'User type not found',
        message: 'The user type you are trying to update does not exist'
      });
    }

    // Check for duplicate name (excluding current record)
    const duplicateUserType = await prisma.user_types.findFirst({
      where: {
        type_name: {
          equals: type_name,
          mode: 'insensitive'
        },
        id: { not: userTypeId }
      }
    });

    if (duplicateUserType) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: {
          type_name: 'User type name already exists'
        }
      });
    }

    // Validate field orders are unique
    const fieldOrders = selectedFields.map(f => f.field_order);
    const uniqueOrders = new Set(fieldOrders);
    if (fieldOrders.length !== uniqueOrders.size) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: {
          selectedFields: 'Field orders must be unique positive numbers'
        }
      });
    }

    // Update user type and field associations in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user type name if changed
      const updatedUserType = await tx.user_types.update({
        where: { id: userTypeId },
        data: {
          type_name: type_name,
          updated_at: new Date()
        }
      });

      // Remove existing field associations
      await tx.user_type_fields.deleteMany({
        where: { user_type_id: userTypeId }
      });

      // Create new field associations
      const fieldAssociations = selectedFields.map(field => ({
        user_type_id: userTypeId,
        field_id: field.field_id,
        is_required: field.is_required,
        field_order: field.field_order
      }));

      await tx.user_type_fields.createMany({
        data: fieldAssociations
      });

      return updatedUserType;
    });

    const responseTime = Date.now() - startTime;

    // Analyze changes
    const oldFieldIds = existingUserType.user_type_fields.map(f => f.field_id).sort();
    const newFieldIds = selectedFields.map(f => f.field_id).sort();
    const changes = {
      name_changed: existingUserType.type_name !== type_name,
      fields_added: newFieldIds.filter(id => !oldFieldIds.includes(id)).length,
      fields_removed: oldFieldIds.filter(id => !newFieldIds.includes(id)).length,
      requirements_changed: selectedFields.length - existingUserType.user_type_fields.length
    };

    logger.info('User type updated successfully', {
      action: 'update_user_type_success',
      admin_id: req.admin.id,
      user_type_id: userTypeId,
      old_name: existingUserType.type_name,
      new_name: type_name,
      changes: changes,
      fields_count: selectedFields.length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'User type updated successfully',
      data: {
        user_type_id: result.id,
        type_name: result.type_name,
        is_active: result.is_active,
        fields_count: selectedFields.length,
        updated_at: result.updated_at,
        changes: changes
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to update user type', {
      action: 'update_user_type_failed',
      admin_id: req.admin?.id,
      user_type_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to update user type',
      message: 'An error occurred while updating the user type'
    });
  }
};

/**
 * Get deletion impact information for user type
 * UC-004 - Admin Delete User Type (Step 2)
 */
const getUserTypeDeleteInfo = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userTypeId = parseInt(id);

    if (!userTypeId || userTypeId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type ID'
      });
    }

    const userType = await prisma.user_types.findUnique({
      where: { id: userTypeId },
      include: {
        requests: {
          select: {
            id: true,
            status: true,
            created_at: true
          }
        }
      }
    });

    if (!userType) {
      return res.status(404).json({
        success: false,
        error: 'User type not found'
      });
    }

    // Check if this is the last active user type
    const activeUserTypesCount = await prisma.user_types.count({
      where: { 
        is_active: true,
        id: { not: userTypeId }
      }
    });

    const requests = userType.requests || [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentRequests = requests.filter(r => new Date(r.created_at) >= twentyFourHoursAgo);
    const activeRequests = requests.filter(r => r.status === 'pending');

    const usage_statistics = {
      total_requests: requests.length,
      active_requests: activeRequests.length,
      recent_requests_24h: recentRequests.length,
      last_request_date: requests.length > 0 ? 
        Math.max(...requests.map(r => new Date(r.created_at).getTime())) : null
    };

    if (usage_statistics.last_request_date) {
      usage_statistics.last_request_date = new Date(usage_statistics.last_request_date).toISOString();
    }

    const safety_check = {
      is_last_user_type: activeUserTypesCount === 0,
      has_recent_activity: recentRequests.length > 0,
      concurrent_edits: false // Would need additional logic to detect this
    };

    const responseTime = Date.now() - startTime;

    logger.info('User type deletion info retrieved', {
      action: 'get_deletion_info',
      admin_id: req.admin.id,
      user_type_id: userTypeId,
      usage_stats: usage_statistics,
      safety_check: safety_check,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        user_type: {
          id: userType.id,
          type_name: userType.type_name,
          is_active: userType.is_active,
          created_at: userType.created_at
        },
        usage_statistics,
        safety_check
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get deletion info', {
      action: 'get_deletion_info_failed',
      admin_id: req.admin?.id,
      user_type_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve deletion information',
      message: 'An error occurred while checking deletion impact'
    });
  }
};

/**
 * Delete user type (with safety checks)
 * UC-004 - Admin Delete User Type
 */
const deleteUserType = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userTypeId = parseInt(id);
    const { confirmed, force_delete } = req.body;

    if (!userTypeId || userTypeId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type ID'
      });
    }

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Deletion must be confirmed',
        message: 'Please confirm the deletion by setting confirmed: true'
      });
    }

    // Check if this is the last active user type
    const activeUserTypesCount = await prisma.user_types.count({
      where: { 
        is_active: true,
        id: { not: userTypeId }
      }
    });

    if (activeUserTypesCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete last user type',
        details: {
          reason: 'system_requires_minimum_one_type',
          suggestion: 'Create another user type before deleting this one',
          current_active_types: 1
        }
      });
    }

    const userType = await prisma.user_types.findUnique({
      where: { id: userTypeId },
      include: {
        requests: {
          select: {
            id: true,
            status: true,
            created_at: true
          }
        }
      }
    });

    if (!userType) {
      return res.status(404).json({
        success: false,
        error: 'User type not found',
        message: 'The user type may have already been deleted'
      });
    }

    // Delete user type and field associations in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mark user type as inactive (soft delete)
      const deletedUserType = await tx.user_types.update({
        where: { id: userTypeId },
        data: {
          is_active: false,
          updated_at: new Date()
        }
      });

      // Remove field associations
      await tx.user_type_fields.deleteMany({
        where: { user_type_id: userTypeId }
      });

      return deletedUserType;
    });

    const responseTime = Date.now() - startTime;

    logger.info('User type deleted successfully', {
      action: 'delete_user_type_success',
      admin_id: req.admin.id,
      user_type_id: userTypeId,
      type_name: userType.type_name,
      affected_requests: userType.requests.length,
      deletion_type: 'soft_delete',
      force_delete: !!force_delete,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'User type deleted successfully',
      data: {
        user_type_id: userTypeId,
        type_name: userType.type_name,
        deletion_type: 'soft_delete',
        affected_requests: userType.requests.length,
        deleted_at: new Date().toISOString()
      },
      summary: {
        action: 'deactivated',
        reason: 'preserve_request_history',
        existing_requests_preserved: true
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to delete user type', {
      action: 'delete_user_type_failed',
      admin_id: req.admin?.id,
      user_type_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to delete user type',
      message: 'An error occurred while deleting the user type'
    });
  }
};

/**
 * Update user type active/inactive status
 * UC-005 - Admin View User Types (Status Toggle)
 */
const updateUserTypeStatus = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const userTypeId = parseInt(id);
    const { is_active } = req.body;

    if (!userTypeId || userTypeId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type ID'
      });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
        message: 'is_active must be a boolean value'
      });
    }

    // If deactivating, check it's not the last active user type
    if (!is_active) {
      const activeUserTypesCount = await prisma.user_types.count({
        where: { 
          is_active: true,
          id: { not: userTypeId }
        }
      });

      if (activeUserTypesCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot deactivate last user type',
          message: 'System requires at least one active user type'
        });
      }
    }

    const updatedUserType = await prisma.user_types.update({
      where: { id: userTypeId },
      data: {
        is_active: is_active,
        updated_at: new Date()
      }
    });

    const responseTime = Date.now() - startTime;

    logger.info('User type status updated', {
      action: 'update_user_type_status',
      admin_id: req.admin.id,
      user_type_id: userTypeId,
      type_name: updatedUserType.type_name,
      old_status: !is_active,
      new_status: is_active,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: `User type ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: {
        user_type_id: updatedUserType.id,
        type_name: updatedUserType.type_name,
        is_active: updatedUserType.is_active,
        updated_at: updatedUserType.updated_at
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to update user type status', {
      action: 'update_status_failed',
      admin_id: req.admin?.id,
      user_type_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to update user type status',
      message: 'An error occurred while updating the status'
    });
  }
};

module.exports = {
  getUserTypes,
  getUserType,
  createUserType,
  updateUserType,
  deleteUserType,
  updateUserTypeStatus,
  getUserTypeDeleteInfo,
  getFieldsMaster
};