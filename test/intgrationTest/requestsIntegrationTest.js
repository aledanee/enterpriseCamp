const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock Prisma
const mockPrisma = {
  user_types: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  user_type_fields: {
    findMany: jest.fn()
  },
  fields_master: {
    findMany: jest.fn()
  },
  requests: {
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
    Object.values(mockPrisma.user_types).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.user_type_fields).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.requests).forEach(fn => fn.mockReset());
  });

  // ───────────────────────────────────────────────
  // PUBLIC ROUTES
  // ───────────────────────────────────────────────

  describe('GET /api/v1/requests/user-types - Public: Active User Types', () => {
    test('should return active user types without auth', async () => {
      const mockUserTypes = [
        { id: 1, type_name: 'student', is_active: true },
        { id: 2, type_name: 'agent', is_active: true }
      ];

      mockPrisma.user_types.findMany.mockResolvedValue(mockUserTypes);

      const response = await request(app)
        .get('/api/v1/requests/user-types')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_types).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    test('should return empty list when no active user types', async () => {
      mockPrisma.user_types.findMany.mockResolvedValue([]);

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
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: true
      });

      mockPrisma.user_type_fields.findMany.mockResolvedValue([
        {
          is_required: true,
          field_order: 1,
          fields_master: {
            id: 1, field_name: 'name', field_label: 'الاسم الكامل',
            field_type: 'text', field_options: null
          }
        },
        {
          is_required: true,
          field_order: 2,
          fields_master: {
            id: 2, field_name: 'email', field_label: 'البريد الإلكتروني',
            field_type: 'email', field_options: null
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
      mockPrisma.user_types.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/requests/user-types/999/fields')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type not found');
    });

    test('should return 400 for inactive user type', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: false
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
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: true
      });

      mockPrisma.user_type_fields.findMany.mockResolvedValue([
        {
          is_required: true,
          fields_master: {
            id: 1, field_name: 'name', field_label: 'الاسم الكامل',
            field_type: 'text', field_options: null
          }
        },
        {
          is_required: true,
          fields_master: {
            id: 2, field_name: 'email', field_label: 'البريد الإلكتروني',
            field_type: 'email', field_options: null
          }
        }
      ]);

      mockPrisma.requests.create.mockResolvedValue({
        id: 1,
        user_type_id: 1,
        data: { name: 'أحمد', email: 'ahmed@mail.com' },
        status: 'pending',
        created_at: new Date('2026-02-14')
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
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: true
      });

      mockPrisma.user_type_fields.findMany.mockResolvedValue([
        {
          is_required: true,
          fields_master: {
            id: 1, field_name: 'name', field_label: 'الاسم الكامل',
            field_type: 'text', field_options: null
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
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: true
      });

      mockPrisma.user_type_fields.findMany.mockResolvedValue([
        {
          is_required: true,
          fields_master: {
            id: 2, field_name: 'email', field_label: 'البريد الإلكتروني',
            field_type: 'email', field_options: null
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
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: true
      });

      mockPrisma.user_type_fields.findMany.mockResolvedValue([
        {
          is_required: true,
          fields_master: {
            id: 7, field_name: 'course', field_label: 'التخصص',
            field_type: 'dropdown', field_options: ['CS', 'Engineering', 'Medicine']
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
      mockPrisma.user_types.findUnique.mockResolvedValue(null);

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
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1, type_name: 'student', is_active: false
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
          user_type_id: 1,
          data: { name: 'أحمد', email: 'ahmed@mail.com' },
          status: 'pending',
          admin_notes: null,
          created_at: new Date('2026-02-14'),
          updated_at: new Date('2026-02-14'),
          processed_at: null,
          user_type: { id: 1, type_name: 'student', is_active: true }
        }
      ];

      mockPrisma.requests.findMany.mockResolvedValue(mockRequests);
      mockPrisma.requests.count
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
      mockPrisma.requests.findMany.mockResolvedValue([]);
      mockPrisma.requests.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1);

      await request(app)
        .get('/api/v1/requests/admin?status=pending')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.requests.findMany).toHaveBeenCalledWith(
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
        user_type_id: 1,
        data: { name: 'أحمد', email: 'ahmed@mail.com' },
        status: 'pending',
        admin_notes: null,
        created_at: new Date('2026-02-14'),
        updated_at: new Date('2026-02-14'),
        processed_at: null,
        user_type: {
          id: 1,
          type_name: 'student',
          user_type_fields: [
            {
              is_required: true,
              field_order: 1,
              fields_master: {
                field_name: 'name', field_label: 'الاسم الكامل', field_type: 'text'
              }
            },
            {
              is_required: true,
              field_order: 2,
              fields_master: {
                field_name: 'email', field_label: 'البريد الإلكتروني', field_type: 'email'
              }
            }
          ]
        }
      };

      mockPrisma.requests.findUnique.mockResolvedValue(mockRequest);

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
      mockPrisma.requests.findUnique.mockResolvedValue(null);

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
      mockPrisma.requests.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
        user_type_id: 1,
        user_type: { id: 1, type_name: 'student' }
      });

      mockPrisma.requests.update.mockResolvedValue({
        id: 1,
        status: 'approved',
        admin_notes: 'تم القبول',
        processed_at: new Date('2026-02-14'),
        updated_at: new Date('2026-02-14')
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
      mockPrisma.requests.findUnique.mockResolvedValue({
        id: 1,
        status: 'pending',
        user_type_id: 1,
        user_type: { id: 1, type_name: 'student' }
      });

      mockPrisma.requests.update.mockResolvedValue({
        id: 1,
        status: 'rejected',
        admin_notes: 'بيانات ناقصة',
        processed_at: new Date('2026-02-14'),
        updated_at: new Date('2026-02-14')
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
      mockPrisma.requests.findUnique.mockResolvedValue({
        id: 1,
        status: 'approved',
        processed_at: new Date('2026-02-13'),
        user_type: { id: 1, type_name: 'student' }
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
