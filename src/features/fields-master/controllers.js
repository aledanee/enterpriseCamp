const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const logger = require('../../shared/services/logger');
const prisma = require('../../db/prisma');

/**
 * Validation schemas for fields master
 */
const createFieldSchema = Joi.object({
  field_name: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Field name can only contain letters, numbers, and underscores',
      'string.min': 'Field name must be at least 2 characters long',
      'string.max': 'Field name cannot exceed 50 characters',
      'any.required': 'Field name is required'
    }),
  field_label: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Field label is required',
      'string.max': 'Field label cannot exceed 100 characters',
      'any.required': 'Field label is required'
    }),
  field_type: Joi.string()
    .valid('text', 'email', 'tel', 'number', 'dropdown', 'textarea')
    .required()
    .messages({
      'any.only': 'Field type must be one of: text, email, tel, number, dropdown, textarea',
      'any.required': 'Field type is required'
    }),
  field_options: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string()),
      Joi.allow(null)
    )
    .optional()
});

const updateFieldSchema = createFieldSchema;

/**
 * Get all fields from fields_master with usage statistics
 * UC-006 - Admin View Fields Master
 */
const getFieldsMaster = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      search = '',
      field_type = 'all',
      sort = 'id',
      order = 'asc',
      page = 1,
      per_page = 25,
      include = 'usage'
    } = req.query;

    const pageNum = parseInt(page);
    const perPage = Math.min(parseInt(per_page), 100);
    const offset = (pageNum - 1) * perPage;

    // Build where clause
    const where = {};
    if (search) {
      where.OR = [
        { fieldName: { contains: search, mode: 'insensitive' } },
        { fieldLabel: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (field_type !== 'all') {
      where.fieldType = field_type;
    }

    // Build order by clause
    const orderBy = {};
    if (sort === 'name') {
      orderBy.fieldName = order;
    } else if (sort === 'type') {
      orderBy.fieldType = order;
    } else if (sort === 'created_at') {
      orderBy.createdAt = order;
    } else {
      orderBy.id = order;
    }

    // Get fields with usage data
    const [fields, totalCount] = await Promise.all([
      prisma.fieldsMaster.findMany({
        where,
        orderBy,
        skip: offset,
        take: perPage,
        include: include.includes('usage') ? {
          userTypeFields: {
            include: {
              userType: {
                select: {
                  id: true,
                  typeName: true,
                  isActive: true
                }
              }
            }
          }
        } : false
      }),
      prisma.fieldsMaster.count({ where })
    ]);

    // Process fields with usage statistics
    const processedFields = fields.map(field => {
      const result = {
        id: field.id,
        field_name: field.fieldName,
        field_label: field.fieldLabel,
        field_type: field.fieldType,
        field_options: field.fieldOptions,
        created_at: field.createdAt,
        updated_at: field.updatedAt
      };

      if (include.includes('usage') && field.userTypeFields) {
        const userTypes = field.userTypeFields.map(utf => ({
          user_type_id: utf.userType.id,
          type_name: utf.userType.typeName,
          is_active: utf.userType.isActive,
          is_required: utf.isRequired,
          field_order: utf.fieldOrder
        }));

        result.usage = {
          total_user_types: userTypes.length,
          active_user_types: userTypes.filter(ut => ut.is_active).length,
          user_types: userTypes
        };
      }

      return result;
    });

    // Get field type counts for metadata
    const fieldTypeCounts = await prisma.fieldsMaster.groupBy({
      by: ['fieldType'],
      _count: { id: true }
    });

    const typeBreakdown = {};
    fieldTypeCounts.forEach(item => {
      typeBreakdown[item.fieldType] = item._count.id;
    });

    const totalPages = Math.ceil(totalCount / perPage);
    const responseTime = Date.now() - startTime;

    logger.info('Fields master retrieved successfully', {
      action: 'get_fields_master',
      admin_id: req.admin.id,
      filters: { search, field_type, sort, order },
      pagination: { page: pageNum, per_page: perPage },
      results_count: processedFields.length,
      total_count: totalCount,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Fields retrieved successfully',
      data: {
        fields: processedFields,
        metadata: {
          total_count: totalCount,
          type_breakdown: typeBreakdown,
          page: pageNum,
          per_page: perPage,
          total_pages: totalPages,
          response_time_ms: responseTime
        }
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
      error: 'Failed to retrieve fields',
      message: 'An error occurred while fetching fields data'
    });
  }
};

/**
 * Get single field details with full usage information
 * UC-006 - Admin View Fields Master (Detail View)
 */
const getFieldDetail = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const fieldId = parseInt(id);

    if (!fieldId || fieldId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field ID',
        message: 'Field ID must be a positive integer'
      });
    }

    const field = await prisma.fieldsMaster.findUnique({
      where: { id: fieldId },
      include: {
        userTypeFields: {
          include: {
            userType: {
              select: {
                id: true,
                typeName: true,
                isActive: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'The requested field does not exist'
      });
    }

    // Build usage details
    const userTypes = field.userTypeFields.map(utf => ({
      user_type_id: utf.userType.id,
      type_name: utf.userType.typeName,
      is_active: utf.userType.isActive,
      is_required: utf.isRequired,
      field_order: utf.fieldOrder,
      created_at: utf.userType.createdAt
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Field detail retrieved successfully', {
      action: 'get_field_detail',
      admin_id: req.admin.id,
      field_id: fieldId,
      field_name: field.fieldName,
      usage_count: userTypes.length,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        field: {
          id: field.id,
          field_name: field.fieldName,
          field_label: field.fieldLabel,
          field_type: field.fieldType,
          field_options: field.fieldOptions,
          created_at: field.createdAt,
          updated_at: field.updatedAt
        },
        usage: {
          total_user_types: userTypes.length,
          active_user_types: userTypes.filter(ut => ut.is_active).length,
          inactive_user_types: userTypes.filter(ut => !ut.is_active).length,
          required_in: userTypes.filter(ut => ut.is_required).length,
          optional_in: userTypes.filter(ut => !ut.is_required).length,
          user_types: userTypes
        }
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get field detail', {
      action: 'get_field_detail_failed',
      admin_id: req.admin?.id,
      field_id: req.params.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve field details',
      message: 'An error occurred while fetching field data'
    });
  }
};

/**
 * Create a new master field
 */
const createField = async (req, res) => {
  const startTime = Date.now();

  try {
    const { error, value } = createFieldSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.reduce((acc, d) => {
          acc[d.path.join('.')] = d.message;
          return acc;
        }, {})
      });
    }

    const { field_name, field_label, field_type, field_options } = value;

    const existing = await prisma.fieldsMaster.findUnique({ where: { fieldName: field_name } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate field name',
        message: `A field with name "${field_name}" already exists`
      });
    }

    const field = await prisma.fieldsMaster.create({
      data: {
        fieldName: field_name,
        fieldLabel: field_label,
        fieldType: field_type,
        fieldOptions: field_options || null,
      }
    });

    const responseTime = Date.now() - startTime;
    logger.info('Field created successfully', {
      action: 'create_field',
      admin_id: req.admin.id,
      field_id: field.id,
      field_name: field.fieldName,
      response_time_ms: responseTime,
    });

    return res.status(201).json({
      success: true,
      message: 'Field created successfully',
      data: {
        field: {
          id: field.id,
          field_name: field.fieldName,
          field_label: field.fieldLabel,
          field_type: field.fieldType,
          field_options: field.fieldOptions,
          created_at: field.createdAt,
          updated_at: field.updatedAt,
        }
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Failed to create field', {
      action: 'create_field_failed',
      admin_id: req.admin?.id,
      error: error.message,
      response_time_ms: responseTime,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to create field',
      message: 'An error occurred while creating the field'
    });
  }
};

/**
 * Update a master field
 */
const updateField = async (req, res) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const fieldId = parseInt(id);

    if (!fieldId || fieldId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field ID',
        message: 'Field ID must be a positive integer'
      });
    }

    const { error, value } = updateFieldSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.reduce((acc, d) => {
          acc[d.path.join('.')] = d.message;
          return acc;
        }, {})
      });
    }

    const existingField = await prisma.fieldsMaster.findUnique({ where: { id: fieldId } });
    if (!existingField) {
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'The requested field does not exist'
      });
    }

    const { field_name, field_label, field_type, field_options } = value;

    const duplicate = await prisma.fieldsMaster.findFirst({
      where: { fieldName: field_name, NOT: { id: fieldId } }
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate field name',
        message: `A field with name "${field_name}" already exists`
      });
    }

    const field = await prisma.fieldsMaster.update({
      where: { id: fieldId },
      data: {
        fieldName: field_name,
        fieldLabel: field_label,
        fieldType: field_type,
        fieldOptions: field_options || null,
      }
    });

    const responseTime = Date.now() - startTime;
    logger.info('Field updated successfully', {
      action: 'update_field',
      admin_id: req.admin.id,
      field_id: field.id,
      response_time_ms: responseTime,
    });

    return res.status(200).json({
      success: true,
      message: 'Field updated successfully',
      data: {
        field: {
          id: field.id,
          field_name: field.fieldName,
          field_label: field.fieldLabel,
          field_type: field.fieldType,
          field_options: field.fieldOptions,
          created_at: field.createdAt,
          updated_at: field.updatedAt,
        }
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Failed to update field', {
      action: 'update_field_failed',
      admin_id: req.admin?.id,
      error: error.message,
      response_time_ms: responseTime,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to update field',
      message: 'An error occurred while updating the field'
    });
  }
};

/**
 * Delete a master field
 */
const deleteField = async (req, res) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const fieldId = parseInt(id);

    if (!fieldId || fieldId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field ID',
        message: 'Field ID must be a positive integer'
      });
    }

    const field = await prisma.fieldsMaster.findUnique({
      where: { id: fieldId },
      include: {
        userTypeFields: {
          include: { userType: { select: { id: true, typeName: true } } }
        }
      }
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'The requested field does not exist'
      });
    }

    if (field.userTypeFields.length > 0) {
      const { force } = req.body || {};
      if (!force) {
        return res.status(409).json({
          success: false,
          error: 'Field in use',
          message: `هذا الحقل مستخدم في ${field.userTypeFields.length} نوع مستخدم. أرسل force: true لتأكيد الحذف.`,
          data: {
            used_by: field.userTypeFields.map(utf => ({
              user_type_id: utf.userType.id,
              type_name: utf.userType.typeName,
            }))
          }
        });
      }
    }

    await prisma.fieldsMaster.delete({ where: { id: fieldId } });

    const responseTime = Date.now() - startTime;
    logger.info('Field deleted successfully', {
      action: 'delete_field',
      admin_id: req.admin.id,
      field_id: fieldId,
      field_name: field.fieldName,
      response_time_ms: responseTime,
    });

    return res.status(200).json({
      success: true,
      message: 'Field deleted successfully',
      data: { id: fieldId, field_name: field.fieldName }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Failed to delete field', {
      action: 'delete_field_failed',
      admin_id: req.admin?.id,
      error: error.message,
      response_time_ms: responseTime,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to delete field',
      message: 'An error occurred while deleting the field'
    });
  }
};

module.exports = {
  getFieldsMaster,
  getFieldDetail,
  createField,
  updateField,
  deleteField
};
