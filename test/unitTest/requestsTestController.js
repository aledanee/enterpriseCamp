// Mock Prisma methods
const mockPrisma = {
  userType: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  userTypeField: {
    findMany: jest.fn()
  },
  fieldsMaster: {
    findUnique: jest.fn()
  },
  request: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  }
};

// Mock dependencies
jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const {
  getActiveUserTypes,
  getUserTypeFields,
  createRequest,
  getRequests,
  getRequest,
  updateRequestStatus
} = require('../../src/features/requests/controllers');
const logger = require('../../src/shared/services/logger');

describe('Requests Controllers - Happy Path Scenarios', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.userType).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.userTypeField).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.request).forEach(mock => mock.mockReset());

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

  // ───────────────────────────────────────────────
  // PUBLIC: getActiveUserTypes
  // ───────────────────────────────────────────────
  describe('getActiveUserTypes - Happy Path', () => {
    test('should return active user types list', async () => {
      const mockUserTypes = [
        { id: 1, typeName: 'student', isActive: true },
        { id: 2, typeName: 'agent', isActive: true }
      ];

      mockPrisma.userType.findMany.mockResolvedValue(mockUserTypes);

      await getActiveUserTypes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            user_types: [
              { id: 1, type_name: 'student', is_active: true },
              { id: 2, type_name: 'agent', is_active: true }
            ],
            count: 2
          }
        })
      );
    });

    test('should return empty list when no active user types', async () => {
      mockPrisma.userType.findMany.mockResolvedValue([]);

      await getActiveUserTypes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'No request types available at this time',
          data: { user_types: [], count: 0 }
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // PUBLIC: getUserTypeFields
  // ───────────────────────────────────────────────
  describe('getUserTypeFields - Happy Path', () => {
    test('should return fields for an active user type', async () => {
      mockReq.params = { id: '1' };

      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          fieldOrder: 1,
          isRequired: true,
          field: {
            id: 1,
            fieldName: 'full_name',
            fieldLabel: 'الاسم الكامل',
            fieldType: 'text',
            fieldOptions: null
          }
        },
        {
          fieldOrder: 2,
          isRequired: true,
          field: {
            id: 2,
            fieldName: 'email',
            fieldLabel: 'البريد',
            fieldType: 'email',
            fieldOptions: null
          }
        }
      ]);

      await getUserTypeFields(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user_type: { id: 1, type_name: 'student' },
            fields: expect.arrayContaining([
              expect.objectContaining({
                field_name: 'full_name',
                field_type: 'text',
                is_required: true
              })
            ]),
            count: 2
          })
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // PUBLIC: createRequest
  // ───────────────────────────────────────────────
  describe('createRequest - Happy Path', () => {
    test('should create a request with valid data', async () => {
      mockReq.body = {
        user_type_id: 1,
        data: {
          full_name: 'Test User',
          email: 'test@example.com'
        }
      };

      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          field: {
            fieldName: 'full_name',
            fieldLabel: 'Full Name',
            fieldType: 'text',
            fieldOptions: null
          }
        },
        {
          isRequired: true,
          field: {
            fieldName: 'email',
            fieldLabel: 'Email',
            fieldType: 'email',
            fieldOptions: null
          }
        }
      ]);

      mockPrisma.request.create.mockResolvedValue({
        id: 1,
        userTypeId: 1,
        data: { full_name: 'Test User', email: 'test@example.com' },
        status: 'pending',
        createdAt: new Date('2026-02-14')
      });

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Request submitted successfully',
          data: expect.objectContaining({
            request_id: 1,
            status: 'pending',
            type_name: 'student'
          })
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // ADMIN: getRequests
  // ───────────────────────────────────────────────
  describe('getRequests - Happy Path', () => {
    test('should return paginated requests with stats', async () => {
      const mockRequests = [
        {
          id: 1,
          userTypeId: 1,
          data: { full_name: 'Ahmed' },
          status: 'pending',
          adminNotes: null,
          createdAt: new Date('2026-02-14'),
          updatedAt: new Date('2026-02-14'),
          processedAt: null,
          userType: { id: 1, typeName: 'student', isActive: true }
        }
      ];

      mockPrisma.request.findMany.mockResolvedValue(mockRequests);
      mockPrisma.request.count
        .mockResolvedValueOnce(1)   // totalCount
        .mockResolvedValueOnce(1)   // pending
        .mockResolvedValueOnce(0)   // approved
        .mockResolvedValueOnce(0);  // rejected

      await getRequests(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            requests: expect.arrayContaining([
              expect.objectContaining({
                id: 1,
                status: 'pending',
                type_name: 'student'
              })
            ]),
            stats: expect.objectContaining({
              pending: 1,
              approved: 0,
              rejected: 0
            })
          })
        })
      );
    });

    test('should filter by status', async () => {
      mockReq.query = { status: 'approved' };

      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count
        .mockResolvedValueOnce(0)   // totalCount
        .mockResolvedValueOnce(0)   // pending
        .mockResolvedValueOnce(0)   // approved
        .mockResolvedValueOnce(0);  // rejected

      await getRequests(mockReq, mockRes);

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' })
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // ADMIN: getRequest
  // ───────────────────────────────────────────────
  describe('getRequest - Happy Path', () => {
    test('should return single request with field details', async () => {
      mockReq.params = { id: '1' };

      mockPrisma.request.findUnique.mockResolvedValue({
        id: 1,
        userTypeId: 1,
        data: { full_name: 'Ahmed', email: 'a@test.com' },
        status: 'pending',
        adminNotes: null,
        createdAt: new Date('2026-02-14'),
        updatedAt: new Date('2026-02-14'),
        processedAt: null,
        userType: {
          typeName: 'student',
          userTypeFields: [
            {
              isRequired: true,
              fieldOrder: 1,
              field: {
                fieldName: 'full_name',
                fieldLabel: 'الاسم',
                fieldType: 'text'
              }
            }
          ]
        }
      });

      await getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            request: expect.objectContaining({
              id: 1,
              status: 'pending'
            }),
            field_details: expect.arrayContaining([
              expect.objectContaining({
                field_name: 'full_name',
                submitted_value: 'Ahmed'
              })
            ])
          })
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // ADMIN: updateRequestStatus
  // ───────────────────────────────────────────────
  describe('updateRequestStatus - Happy Path', () => {
    test('should approve a pending request', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'approved', admin_notes: 'Looks good' };

      mockPrisma.request.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
        userTypeId: 1,
        userType: { id: 1, typeName: 'student' }
      });

      mockPrisma.request.update.mockResolvedValue({
        id: 1,
        status: 'approved',
        adminNotes: 'Looks good',
        processedAt: new Date('2026-02-14'),
        updatedAt: new Date('2026-02-14')
      });

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Request status updated successfully',
          data: expect.objectContaining({
            old_status: 'pending',
            new_status: 'approved'
          })
        })
      );
    });

    test('should reject a pending request', async () => {
      mockReq.params = { id: '2' };
      mockReq.body = { status: 'rejected', admin_notes: 'Incomplete documents' };

      mockPrisma.request.findUnique.mockResolvedValue({
        id: 2,
        status: 'pending',
        userTypeId: 1,
        userType: { id: 1, typeName: 'student' }
      });

      mockPrisma.request.update.mockResolvedValue({
        id: 2,
        status: 'rejected',
        adminNotes: 'Incomplete documents',
        processedAt: new Date('2026-02-14'),
        updatedAt: new Date('2026-02-14')
      });

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            new_status: 'rejected'
          })
        })
      );
    });
  });
});

describe('Requests Controllers - Error Scenarios', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.userType).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.userTypeField).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.request).forEach(mock => mock.mockReset());

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

  describe('getActiveUserTypes - Error Path', () => {
    test('should return 500 when database fails', async () => {
      mockPrisma.userType.findMany.mockRejectedValue(new Error('DB down'));

      await getActiveUserTypes(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getUserTypeFields - Error Path', () => {
    test('should return 400 for invalid user type ID', async () => {
      mockReq.params = { id: 'abc' };

      await getUserTypeFields(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Invalid user type ID' })
      );
    });

    test('should return 404 when user type not found', async () => {
      mockReq.params = { id: '999' };
      mockPrisma.userType.findUnique.mockResolvedValue(null);

      await getUserTypeFields(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'User type not found' })
      );
    });

    test('should return 400 when user type is inactive', async () => {
      mockReq.params = { id: '1' };
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'test', isActive: false
      });

      await getUserTypeFields(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'User type inactive' })
      );
    });
  });

  describe('createRequest - Error Path', () => {
    test('should return 400 when validation fails (missing user_type_id)', async () => {
      mockReq.body = { data: { full_name: 'Test' } };

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Validation failed' })
      );
    });

    test('should return 400 when validation fails (missing data)', async () => {
      mockReq.body = { user_type_id: 1 };

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should return 404 when user type not found', async () => {
      mockReq.body = { user_type_id: 999, data: { name: 'Test' } };
      mockPrisma.userType.findUnique.mockResolvedValue(null);

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('should return 400 when user type is inactive', async () => {
      mockReq.body = { user_type_id: 1, data: { name: 'Test' } };
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'test', isActive: false
      });

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'User type inactive' })
      );
    });

    test('should return 400 when required field is missing', async () => {
      mockReq.body = { user_type_id: 1, data: {} };

      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          field: {
            fieldName: 'full_name',
            fieldLabel: 'Full Name',
            fieldType: 'text',
            fieldOptions: null
          }
        }
      ]);

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          details: expect.objectContaining({
            full_name: 'Full Name is required'
          })
        })
      );
    });

    test('should return 400 when email format is invalid', async () => {
      mockReq.body = { user_type_id: 1, data: { email: 'not-an-email' } };

      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: false,
          field: {
            fieldName: 'email',
            fieldLabel: 'Email',
            fieldType: 'email',
            fieldOptions: null
          }
        }
      ]);

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            email: 'Invalid email format'
          })
        })
      );
    });

    test('should return 400 when dropdown value is invalid', async () => {
      mockReq.body = { user_type_id: 1, data: { gender: 'invalid' } };

      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: false,
          field: {
            fieldName: 'gender',
            fieldLabel: 'Gender',
            fieldType: 'dropdown',
            fieldOptions: ['male', 'female']
          }
        }
      ]);

      await createRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            gender: expect.stringContaining('Invalid option')
          })
        })
      );
    });
  });

  describe('getRequest - Error Path', () => {
    test('should return 400 for invalid request ID', async () => {
      mockReq.params = { id: 'abc' };

      await getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid request ID' })
      );
    });

    test('should return 404 when request not found', async () => {
      mockReq.params = { id: '999' };
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await getRequest(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateRequestStatus - Error Path', () => {
    test('should return 400 for invalid request ID', async () => {
      mockReq.params = { id: 'abc' };
      mockReq.body = { status: 'approved' };

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should return 400 for invalid status value', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'invalid_status' };

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Validation failed' })
      );
    });

    test('should return 404 when request not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { status: 'approved' };
      mockPrisma.request.findUnique.mockResolvedValue(null);

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('should return 409 when request already processed', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'approved' };

      mockPrisma.request.findUnique.mockResolvedValue({
        id: 1,
        status: 'approved',
        processedAt: new Date('2026-02-14'),
        userType: { id: 1, typeName: 'student' }
      });

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Request already processed'
        })
      );
    });

    test('should return 500 on database failure', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'approved' };

      mockPrisma.request.findUnique.mockRejectedValue(new Error('DB error'));

      await updateRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
