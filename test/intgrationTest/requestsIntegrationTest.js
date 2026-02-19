const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock Prisma
const mockPrisma = {
  userType: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  userTypeField: {
    findMany: jest.fn()
  },
  fieldsMaster: {
    findMany: jest.fn()
  },
  request: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  }
};

jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const requestsRouter = require('../../src/features/requests/router');

describe('Requests Integration Tests', () => {
  let app;
  let validToken;
  const JWT_SECRET = 'test-integration-jwt-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    validToken = jwt.sign(
      { email: 'admin@lesone.com', role: 'admin', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/v1/requests', requestsRouter);
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.userType).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.userTypeField).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.request).forEach(fn => fn.mockReset());
  });

  // ───────────────────────────────────────────────
  // PUBLIC ROUTES
  // ───────────────────────────────────────────────

  describe('GET /api/v1/requests/user-types - Public: Active User Types', () => {
    test('should return active user types without auth', async () => {
      const mockUserTypes = [
        { id: 1, typeName: 'student', isActive: true },
        { id: 2, typeName: 'agent', isActive: true }
      ];

      mockPrisma.userType.findMany.mockResolvedValue(mockUserTypes);

      const response = await request(app)
        .get('/api/v1/requests/user-types')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_types).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    test('should return empty list when no active user types', async () => {
      mockPrisma.userType.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/requests/user-types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_types).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
    });
  });

  describe('GET /api/v1/requests/user-types/:id/fields - Public: User Type Fields', () => {
    test('should return fields for active user type without auth', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          fieldOrder: 1,
          field: {
            id: 1, fieldName: 'name', fieldLabel: 'الاسم الكامل',
            fieldType: 'text', fieldOptions: null
          }
        },
        {
          isRequired: true,
          fieldOrder: 2,
          field: {
            id: 2, fieldName: 'email', fieldLabel: 'البريد الإلكتروني',
            fieldType: 'email', fieldOptions: null
          }
        }
      ]);

      const response = await request(app)
        .get('/api/v1/requests/user-types/1/fields')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fields).toHaveLength(2);
      expect(response.body.data.user_type).toMatchObject({
        id: 1, type_name: 'student'
      });
    });

    test('should return 404 for non-existent user type', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/requests/user-types/999/fields')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type not found');
    });

    test('should return 400 for inactive user type', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: false
      });

      const response = await request(app)
        .get('/api/v1/requests/user-types/1/fields')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type inactive');
    });
  });

  describe('POST /api/v1/requests - Public: Create Request', () => {
    test('should create request with valid data without auth', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          field: {
            id: 1, fieldName: 'name', fieldLabel: 'الاسم الكامل',
            fieldType: 'text', fieldOptions: null
          }
        },
        {
          isRequired: true,
          field: {
            id: 2, fieldName: 'email', fieldLabel: 'البريد الإلكتروني',
            fieldType: 'email', fieldOptions: null
          }
        }
      ]);

      mockPrisma.request.create.mockResolvedValue({
        id: 1,
        userTypeId: 1,
        data: { name: 'أحمد', email: 'ahmed@mail.com' },
        status: 'pending',
        createdAt: new Date('2026-02-14')
      });

      const response = await request(app)
        .post('/api/v1/requests')
        .send({
          user_type_id: 1,
          data: { name: 'أحمد', email: 'ahmed@mail.com' }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Request submitted successfully');
      expect(response.body.data).toMatchObject({
        request_id: 1,
        status: 'pending'
      });
    });

    test('should reject request with missing required fields', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          field: {
            id: 1, fieldName: 'name', fieldLabel: 'الاسم الكامل',
            fieldType: 'text', fieldOptions: null
          }
        }
      ]);

      const response = await request(app)
        .post('/api/v1/requests')
        .send({
          user_type_id: 1,
          data: {}
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toHaveProperty('name');
    });

    test('should reject request with invalid email format', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          field: {
            id: 2, fieldName: 'email', fieldLabel: 'البريد الإلكتروني',
            fieldType: 'email', fieldOptions: null
          }
        }
      ]);

      const response = await request(app)
        .post('/api/v1/requests')
        .send({
          user_type_id: 1,
          data: { email: 'invalid-email' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toHaveProperty('email');
    });

    test('should reject request with invalid dropdown option', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: true
      });

      mockPrisma.userTypeField.findMany.mockResolvedValue([
        {
          isRequired: true,
          field: {
            id: 7, fieldName: 'course', fieldLabel: 'التخصص',
            fieldType: 'dropdown', fieldOptions: ['CS', 'Engineering', 'Medicine']
          }
        }
      ]);

      const response = await request(app)
        .post('/api/v1/requests')
        .send({
          user_type_id: 1,
          data: { course: 'InvalidCourse' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toHaveProperty('course');
    });

    test('should reject request without user_type_id', async () => {
      const response = await request(app)
        .post('/api/v1/requests')
        .send({ data: { name: 'Test' } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject request for non-existent user type', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/requests')
        .send({
          user_type_id: 999,
          data: { name: 'Test' }
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type not found');
    });

    test('should reject request for inactive user type', async () => {
      mockPrisma.userType.findUnique.mockResolvedValue({
        id: 1, typeName: 'student', isActive: false
      });

      const response = await request(app)
        .post('/api/v1/requests')
        .send({
          user_type_id: 1,
          data: { name: 'Test' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type inactive');
    });
  });

  // ───────────────────────────────────────────────
  // ADMIN ROUTES
  // ───────────────────────────────────────────────

  describe('GET /api/v1/requests/admin - Admin: List Requests', () => {
    test('should reject without auth token', async () => {
      const response = await request(app)
        .get('/api/v1/requests/admin')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should return paginated requests list', async () => {
      const mockRequests = [
        {
          id: 1,
          userTypeId: 1,
          data: { name: 'أحمد', email: 'ahmed@mail.com' },
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
        .mockResolvedValueOnce(1)  // totalCount
        .mockResolvedValueOnce(1)  // pending
        .mockResolvedValueOnce(0)  // approved
        .mockResolvedValueOnce(0); // rejected

      const response = await request(app)
        .get('/api/v1/requests/admin')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.stats).toMatchObject({
        pending: 1,
        approved: 0,
        rejected: 0
      });
    });

    test('should filter by status', async () => {
      mockPrisma.request.findMany.mockResolvedValue([]);
      mockPrisma.request.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1);

      await request(app)
        .get('/api/v1/requests/admin?status=pending')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' }
        })
      );
    });
  });

  describe('GET /api/v1/requests/admin/:id - Admin: Request Detail', () => {
    test('should return request details with field labels', async () => {
      const mockRequest = {
        id: 1,
        userTypeId: 1,
        data: { name: 'أحمد', email: 'ahmed@mail.com' },
        status: 'pending',
        adminNotes: null,
        createdAt: new Date('2026-02-14'),
        updatedAt: new Date('2026-02-14'),
        processedAt: null,
        userType: {
          id: 1,
          typeName: 'student',
          userTypeFields: [
            {
              isRequired: true,
              fieldOrder: 1,
              field: {
                fieldName: 'name', fieldLabel: 'الاسم الكامل', fieldType: 'text'
              }
            },
            {
              isRequired: true,
              fieldOrder: 2,
              field: {
                fieldName: 'email', fieldLabel: 'البريد الإلكتروني', fieldType: 'email'
              }
            }
          ]
        }
      };

      mockPrisma.request.findUnique.mockResolvedValue(mockRequest);

      const response = await request(app)
        .get('/api/v1/requests/admin/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.request).toMatchObject({
        id: 1,
        status: 'pending',
        type_name: 'student'
      });
      expect(response.body.data.field_details).toHaveLength(2);
      expect(response.body.data.field_details[0]).toMatchObject({
        field_name: 'name',
        field_label: 'الاسم الكامل',
        submitted_value: 'أحمد'
      });
    });

    test('should return 404 for non-existent request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/requests/admin/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request not found');
    });
  });

  describe('PUT /api/v1/requests/admin/:id/status - Admin: Update Status', () => {
    test('should approve a pending request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
        userTypeId: 1,
        userType: { id: 1, typeName: 'student' }
      });

      mockPrisma.request.update.mockResolvedValue({
        id: 1,
        status: 'approved',
        adminNotes: 'تم القبول',
        processedAt: new Date('2026-02-14'),
        updatedAt: new Date('2026-02-14')
      });

      const response = await request(app)
        .put('/api/v1/requests/admin/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ status: 'approved', admin_notes: 'تم القبول' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Request status updated successfully');
      expect(response.body.data).toMatchObject({
        request_id: 1,
        old_status: 'pending',
        new_status: 'approved'
      });
    });

    test('should reject a pending request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
        userTypeId: 1,
        userType: { id: 1, typeName: 'student' }
      });

      mockPrisma.request.update.mockResolvedValue({
        id: 1,
        status: 'rejected',
        adminNotes: 'بيانات ناقصة',
        processedAt: new Date('2026-02-14'),
        updatedAt: new Date('2026-02-14')
      });

      const response = await request(app)
        .put('/api/v1/requests/admin/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ status: 'rejected', admin_notes: 'بيانات ناقصة' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.new_status).toBe('rejected');
    });

    test('should return 409 for already processed request', async () => {
      mockPrisma.request.findUnique.mockResolvedValue({
        id: 1,
        status: 'approved',
        processedAt: new Date('2026-02-13'),
        userType: { id: 1, typeName: 'student' }
      });

      const response = await request(app)
        .put('/api/v1/requests/admin/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ status: 'rejected' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Request already processed');
    });

    test('should reject invalid status value', async () => {
      const response = await request(app)
        .put('/api/v1/requests/admin/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject without auth token', async () => {
      const response = await request(app)
        .put('/api/v1/requests/admin/1/status')
        .send({ status: 'approved' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
