const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const logger = require('../../shared/services/logger');
const prisma = require('../../db/prisma');

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

module.exports = {
  getFieldsMaster,
  getFieldDetail
};
