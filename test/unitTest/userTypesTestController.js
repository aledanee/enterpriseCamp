// Mock Prisma methods
const mockPrisma = {
  user_types: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  fields_master: {
    findMany: jest.fn()
  },
  user_type_fields: {
    createMany: jest.fn(),
    deleteMany: jest.fn()
  },
  $transaction: jest.fn()
};

// Mock dependencies - mock the shared prisma module to return our mock
jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const { 
  getUserTypes,
  getUserType,
  createUserType,
  updateUserType,
  deleteUserType,
  updateUserTypeStatus,
  getUserTypeDeleteInfo,
  getFieldsMaster
} = require('../../src/features/user-types/controllers');
const logger = require('../../src/shared/services/logger');

describe('User Types Controllers - Happy Path Scenarios', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    Object.values(mockPrisma.user_types).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.fields_master).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.user_type_fields).forEach(mock => mock.mockReset());
    mockPrisma.$transaction.mockReset();
    
    // Mock request object
    mockReq = {
      body: {},
      params: {},
      query: {},
      admin: { id: 1, email: 'admin@lesone.com' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn(() => 'Mozilla/5.0 Test Browser')
    };

    // Mock response object
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(() => mockRes)
    };
  });

  describe('getUserTypes - Happy Path', () => {
    test('should successfully retrieve user types list with default parameters', async () => {
      const mockUserTypes = [
        {
          id: 1,
          type_name: 'student',
          is_active: true,
          created_at: new Date('2026-01-15'),
          updated_at: new Date('2026-01-15'),
          user_type_fields: [
            {
              field_id: 1,
              is_required: true,
              field_order: 1,
              fields_master: {
                field_name: 'name',
                field_label: 'الاسم الكامل',
                field_type: 'text'
              }
            }
          ],
          requests: [
            { id: 1, status: 'pending', created_at: new Date('2026-02-01') },
            { id: 2, status: 'approved', created_at: new Date('2026-02-02') }
          ]
        }
      ];

      mockPrisma.user_types.findMany.mockResolvedValue(mockUserTypes);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(1) // total count
        .mockResolvedValueOnce(1) // active count
        .mockResolvedValueOnce(0); // inactive count

      mockReq.query = { include: 'fields,stats' };

      await getUserTypes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user_types: expect.arrayContaining([
            expect.objectContaining({
              id: 1,
              type_name: 'student',
              is_active: true,
              fields_count: 1,
              usage_stats: expect.objectContaining({
                total_requests: 2,
                active_requests: 1,
                completed_requests: 1
              })
            })
          ]),
          metadata: expect.objectContaining({
            total_count: 1,
            active_count: 1,
            inactive_count: 0
          })
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User types retrieved successfully',
        expect.objectContaining({
          action: 'get_user_types',
          admin_id: 1,
          results_count: 1
        })
      );
    });

    test('should handle search and filtering parameters', async () => {
      const mockUserTypes = [];
      
      mockPrisma.user_types.findMany.mockResolvedValue(mockUserTypes);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(0) // total count
        .mockResolvedValueOnce(1) // active count
        .mockResolvedValueOnce(0); // inactive count

      mockReq.query = {
        search: 'student',
        status: 'active',
        sort: 'name',
        order: 'asc',
        page: '1',
        per_page: '25'
      };

      await getUserTypes(mockReq, mockRes);

      expect(mockPrisma.user_types.findMany).toHaveBeenCalledWith({
        where: {
          type_name: {
            contains: 'student',
            mode: 'insensitive'
          },
          is_active: true
        },
        orderBy: {
          type_name: 'asc'
        },
        skip: 0,
        take: 25,
        include: expect.any(Object)
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getUserType - Happy Path', () => {
    test('should successfully retrieve specific user type details', async () => {
      const mockUserType = {
        id: 1,
        type_name: 'student',
        is_active: true,
        created_at: new Date('2026-01-15'),
        updated_at: new Date('2026-01-15'),
        user_type_fields: [
          {
            field_id: 1,
            is_required: true,
            field_order: 1,
            fields_master: {
              field_name: 'name',
              field_label: 'الاسم الكامل',
              field_type: 'text',
              field_options: null
            }
          }
        ],
        requests: [
          { id: 1, status: 'pending', created_at: new Date('2026-02-01') }
        ]
      };

      mockPrisma.user_types.findUnique.mockResolvedValue(mockUserType);
      mockReq.params = { id: '1' };

      await getUserType(mockReq, mockRes);

      expect(mockPrisma.user_types.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.objectContaining({
          user_type_fields: expect.any(Object),
          requests: expect.any(Object)
        })
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user_type: expect.objectContaining({
            id: 1,
            type_name: 'student'
          }),
          fields: expect.arrayContaining([
            expect.objectContaining({
              field_id: 1,
              field_name: 'name',
              field_label: 'الاسم الكامل'
            })
          ]),
          usage_analytics: expect.objectContaining({
            total_requests: 1,
            status_breakdown: expect.any(Object)
          })
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User type details retrieved',
        expect.objectContaining({
          action: 'get_user_type_details',
          admin_id: 1,
          user_type_id: 1
        })
      );
    });

    test('should handle invalid user type ID', async () => {
      mockReq.params = { id: 'invalid' };

      await getUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user type ID',
        message: 'User type ID must be a positive integer'
      });
    });

    test('should handle user type not found', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue(null);
      mockReq.params = { id: '999' };

      await getUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User type not found',
        message: 'The requested user type does not exist'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'User type not found',
        expect.objectContaining({
          action: 'get_user_type_not_found',
          user_type_id: 999
        })
      );
    });
  });

  describe('getFieldsMaster - Happy Path', () => {
    test('should successfully retrieve available fields', async () => {
      const mockFields = [
        {
          id: 1,
          field_name: 'name',
          field_label: 'الاسم الكامل',
          field_type: 'text',
          field_options: null,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          field_name: 'email',
          field_label: 'البريد الإلكتروني',
          field_type: 'email',
          field_options: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockPrisma.fields_master.findMany.mockResolvedValue(mockFields);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fields_master.findMany).toHaveBeenCalledWith({
        orderBy: { field_name: 'asc' }
      });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          fields: mockFields,
          count: 2
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Fields master retrieved',
        expect.objectContaining({
          action: 'get_fields_master',
          admin_id: 1,
          fields_count: 2
        })
      );
    });

    test('should handle empty fields master table', async () => {
      mockPrisma.fields_master.findMany.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No fields available',
        message: 'No fields available. Please contact system administrator'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Fields master table is empty',
        expect.objectContaining({
          action: 'get_fields_master_empty'
        })
      );
    });
  });

  describe('createUserType - Happy Path', () => {
    test('should successfully create new user type', async () => {
      const requestData = {
        type_name: 'contractor',
        selectedFields: [
          { field_id: 1, is_required: true, field_order: 1 },
          { field_id: 2, is_required: true, field_order: 2 }
        ]
      };

      const mockCreatedUserType = {
        id: 3,
        type_name: 'contractor',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockValidFields = [
        { id: 1, field_name: 'name' },
        { id: 2, field_name: 'email' }
      ];

      mockPrisma.user_types.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.fields_master.findMany.mockResolvedValue(mockValidFields);
      mockPrisma.$transaction.mockResolvedValue(mockCreatedUserType);

      mockReq.body = requestData;

      await createUserType(mockReq, mockRes);

      expect(mockPrisma.user_types.findFirst).toHaveBeenCalledWith({
        where: {
          type_name: {
            equals: 'contractor',
            mode: 'insensitive'
          }
        }
      });

      expect(mockPrisma.fields_master.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] }
        }
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User type created successfully',
        data: expect.objectContaining({
          user_type_id: 3,
          type_name: 'contractor',
          fields_count: 2
        })
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User type created successfully',
        expect.objectContaining({
          action: 'create_user_type_success',
          admin_id: 1,
          user_type_id: 3
        })
      );
    });

    test('should handle validation errors', async () => {
      const invalidRequestData = {
        type_name: '', // Invalid: empty name
        selectedFields: [] // Invalid: no fields selected
      };

      mockReq.body = invalidRequestData;

      await createUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Object)
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'User type creation validation failed',
        expect.objectContaining({
          action: 'create_user_type_validation_failed'
        })
      );
    });

    test('should handle duplicate user type name', async () => {
      const requestData = {
        type_name: 'student',
        selectedFields: [
          { field_id: 1, is_required: true, field_order: 1 }
        ]
      };

      const mockExistingUserType = {
        id: 1,
        type_name: 'student'
      };

      mockPrisma.user_types.findFirst.mockResolvedValue(mockExistingUserType);

      mockReq.body = requestData;

      await createUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: {
          type_name: 'User type name already exists'
        }
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'User type creation failed - duplicate name',
        expect.objectContaining({
          action: 'create_user_type_duplicate'
        })
      );
    });
  });

  describe('updateUserType - Happy Path', () => {
    test('should successfully update existing user type', async () => {
      const requestData = {
        type_name: 'contractor_updated',
        selectedFields: [
          { field_id: 1, is_required: true, field_order: 1 },
          { field_id: 3, is_required: false, field_order: 2 }
        ]
      };

      const mockExistingUserType = {
        id: 2,
        type_name: 'contractor',
        is_active: true,
        user_type_fields: [
          { field_id: 1, is_required: true, field_order: 1 },
          { field_id: 2, is_required: true, field_order: 2 }
        ]
      };

      const mockUpdatedUserType = {
        id: 2,
        type_name: 'contractor_updated',
        is_active: true,
        updated_at: new Date()
      };

      mockPrisma.user_types.findUnique.mockResolvedValue(mockExistingUserType);
      mockPrisma.user_types.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.$transaction.mockResolvedValue(mockUpdatedUserType);

      mockReq.params = { id: '2' };
      mockReq.body = requestData;

      await updateUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User type updated successfully',
        data: expect.objectContaining({
          user_type_id: 2,
          type_name: 'contractor_updated',
          changes: expect.objectContaining({
            name_changed: true,
            fields_added: 1,
            fields_removed: 1
          })
        })
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User type updated successfully',
        expect.objectContaining({
          action: 'update_user_type_success',
          admin_id: 1,
          user_type_id: 2
        })
      );
    });
  });

  describe('getUserTypeDeleteInfo - Happy Path', () => {
    test('should successfully retrieve deletion impact information', async () => {
      const mockUserType = {
        id: 2,
        type_name: 'contractor',
        is_active: true,
        created_at: new Date('2026-01-20'),
        requests: [
          { id: 1, status: 'pending', created_at: new Date('2026-02-06') },
          { id: 2, status: 'approved', created_at: new Date('2026-02-05') }
        ]
      };

      mockPrisma.user_types.findUnique.mockResolvedValue(mockUserType);
      mockPrisma.user_types.count.mockResolvedValue(2); // Other active user types exist

      mockReq.params = { id: '2' };

      await getUserTypeDeleteInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user_type: expect.objectContaining({
            id: 2,
            type_name: 'contractor'
          }),
          usage_statistics: expect.objectContaining({
            total_requests: 2,
            active_requests: 1
          }),
          safety_check: expect.objectContaining({
            is_last_user_type: false
          })
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User type deletion info retrieved',
        expect.objectContaining({
          action: 'get_deletion_info',
          admin_id: 1,
          user_type_id: 2
        })
      );
    });
  });

  describe('deleteUserType - Happy Path', () => {
    test('should successfully delete user type with confirmation', async () => {
      const mockUserType = {
        id: 2,
        type_name: 'contractor',
        is_active: true,
        requests: [
          { id: 1, status: 'approved', created_at: new Date('2026-02-01') }
        ]
      };

      const mockDeletedUserType = {
        id: 2,
        type_name: 'contractor',
        is_active: false,
        updated_at: new Date()
      };

      mockPrisma.user_types.count.mockResolvedValue(2); // Other active types exist
      mockPrisma.user_types.findUnique.mockResolvedValue(mockUserType);
      mockPrisma.$transaction.mockResolvedValue(mockDeletedUserType);

      mockReq.params = { id: '2' };
      mockReq.body = { confirmed: true };

      await deleteUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User type deleted successfully',
        data: expect.objectContaining({
          user_type_id: 2,
          type_name: 'contractor',
          deletion_type: 'soft_delete'
        }),
        summary: expect.objectContaining({
          action: 'deactivated',
          existing_requests_preserved: true
        })
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User type deleted successfully',
        expect.objectContaining({
          action: 'delete_user_type_success',
          admin_id: 1,
          user_type_id: 2
        })
      );
    });

    test('should prevent deletion of last user type', async () => {
      mockPrisma.user_types.count.mockResolvedValue(0); // No other active types

      mockReq.params = { id: '1' };
      mockReq.body = { confirmed: true };

      await deleteUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot delete last user type',
        details: expect.objectContaining({
          reason: 'system_requires_minimum_one_type',
          suggestion: 'Create another user type before deleting this one'
        })
      });
    });

    test('should require confirmation for deletion', async () => {
      mockReq.params = { id: '2' };
      mockReq.body = {}; // No confirmation

      await deleteUserType(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Deletion must be confirmed',
        message: 'Please confirm the deletion by setting confirmed: true'
      });
    });
  });

  describe('updateUserTypeStatus - Happy Path', () => {
    test('should successfully update user type status to inactive', async () => {
      const mockUpdatedUserType = {
        id: 2,
        type_name: 'contractor',
        is_active: false,
        updated_at: new Date()
      };

      mockPrisma.user_types.count.mockResolvedValue(2); // Other active types exist
      mockPrisma.user_types.update.mockResolvedValue(mockUpdatedUserType);

      mockReq.params = { id: '2' };
      mockReq.body = { is_active: false };

      await updateUserTypeStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User type deactivated successfully',
        data: expect.objectContaining({
          user_type_id: 2,
          type_name: 'contractor',
          is_active: false
        })
      });

      expect(logger.info).toHaveBeenCalledWith(
        'User type status updated',
        expect.objectContaining({
          action: 'update_user_type_status',
          admin_id: 1,
          user_type_id: 2,
          new_status: false
        })
      );
    });

    test('should successfully update user type status to active', async () => {
      const mockUpdatedUserType = {
        id: 2,
        type_name: 'contractor',
        is_active: true,
        updated_at: new Date()
      };

      mockPrisma.user_types.update.mockResolvedValue(mockUpdatedUserType);

      mockReq.params = { id: '2' };
      mockReq.body = { is_active: true };

      await updateUserTypeStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User type activated successfully',
        data: expect.objectContaining({
          user_type_id: 2,
          is_active: true
        })
      });
    });

    test('should prevent deactivating last active user type', async () => {
      mockPrisma.user_types.count.mockResolvedValue(0); // No other active types

      mockReq.params = { id: '1' };
      mockReq.body = { is_active: false };

      await updateUserTypeStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot deactivate last user type',
        message: 'System requires at least one active user type'
      });
    });

    test('should handle invalid status value', async () => {
      mockReq.params = { id: '2' };
      mockReq.body = { is_active: 'invalid' }; // Not boolean

      await updateUserTypeStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid status value',
        message: 'is_active must be a boolean value'
      });
    });
  });
});

describe('User Types Controllers - Error Handling', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      params: {},
      query: {},
      admin: { id: 1, email: 'admin@lesone.com' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn(() => 'Mozilla/5.0 Test Browser')
    };

    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(() => mockRes)
    };
  });

  test('should handle database errors gracefully', async () => {
    const dbError = new Error('Database connection failed');
    mockPrisma.user_types.findMany.mockRejectedValue(dbError);

    await getUserTypes(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Failed to retrieve user types',
      message: 'An error occurred while fetching user types data'
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to get user types',
      expect.objectContaining({
        action: 'get_user_types_failed',
        error: 'Database connection failed'
      })
    );
  });

  test('should handle transaction failures in createUserType', async () => {
    const requestData = {
      type_name: 'contractor',
      selectedFields: [
        { field_id: 1, is_required: true, field_order: 1 }
      ]
    };

    const mockValidFields = [{ id: 1, field_name: 'name' }];
    const transactionError = new Error('Transaction failed');

    mockPrisma.user_types.findFirst.mockResolvedValue(null);
    mockPrisma.fields_master.findMany.mockResolvedValue(mockValidFields);
    mockPrisma.$transaction.mockRejectedValue(transactionError);

    mockReq.body = requestData;

    await createUserType(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Failed to create user type',
      message: 'An error occurred while creating the user type'
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to create user type',
      expect.objectContaining({
        action: 'create_user_type_failed',
        error: 'Transaction failed'
      })
    );
  });
});