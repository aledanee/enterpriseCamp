const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock Prisma (shared singleton) before importing anything that uses it
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

jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const userTypesRouter = require('../../src/features/user-types/router');

describe('User Types Integration Tests', () => {
  let app;
  let validToken;
  const JWT_SECRET = 'test-integration-jwt-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    // Generate a valid admin token
    validToken = jwt.sign(
      { email: 'admin@lesone.com', role: 'admin', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/v1/user-types', userTypesRouter);
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.user_types).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.fields_master).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.user_type_fields).forEach(fn => fn.mockReset());
    mockPrisma.$transaction.mockReset();
  });

  // ───────────────────────────────────────────────
  // Authentication Guard
  // ───────────────────────────────────────────────
  describe('Authentication Guard', () => {
    test('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/user-types')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/user-types')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { email: 'admin@lesone.com', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/v1/user-types')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/user-types
  // ───────────────────────────────────────────────
  describe('GET /api/v1/user-types - List User Types', () => {
    const sampleUserTypes = [
      {
        id: 1,
        type_name: 'student',
        is_active: true,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
        user_type_fields: [
          {
            field_id: 1,
            is_required: true,
            field_order: 1,
            fields_master: { field_name: 'first_name', field_label: 'First Name', field_type: 'text' }
          }
        ],
        requests: [
          { id: 1, status: 'pending', created_at: new Date('2026-02-01') }
        ]
      },
      {
        id: 2,
        type_name: 'employee',
        is_active: true,
        created_at: new Date('2026-01-15'),
        updated_at: new Date('2026-01-15'),
        user_type_fields: [],
        requests: []
      }
    ];

    test('should return paginated list of user types', async () => {
      mockPrisma.user_types.findMany.mockResolvedValue(sampleUserTypes);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(2)   // totalCount
        .mockResolvedValueOnce(2)   // activeCount
        .mockResolvedValueOnce(0);  // inactiveCount

      const response = await request(app)
        .get('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_types).toHaveLength(2);
      expect(response.body.data.metadata).toMatchObject({
        total_count: 2,
        active_count: 2,
        inactive_count: 0,
        page: 1,
        per_page: 25
      });
    });

    test('should pass search query parameter to Prisma', async () => {
      mockPrisma.user_types.findMany.mockResolvedValue([]);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/user-types?search=student&status=active')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.user_types.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type_name: { contains: 'student', mode: 'insensitive' },
            is_active: true
          }
        })
      );
    });

    test('should handle pagination parameters', async () => {
      mockPrisma.user_types.findMany.mockResolvedValue([]);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(10);

      const response = await request(app)
        .get('/api/v1/user-types?page=2&per_page=10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.user_types.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10
        })
      );

      expect(response.body.data.metadata.page).toBe(2);
      expect(response.body.data.metadata.per_page).toBe(10);
    });

    test('should cap per_page at 100', async () => {
      mockPrisma.user_types.findMany.mockResolvedValue([]);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/user-types?per_page=500')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.user_types.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100
        })
      );
    });

    test('should return empty list when no user types exist', async () => {
      mockPrisma.user_types.findMany.mockResolvedValue([]);
      mockPrisma.user_types.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const response = await request(app)
        .get('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.data.user_types).toHaveLength(0);
      expect(response.body.data.metadata.total_count).toBe(0);
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/user-types/:id
  // ───────────────────────────────────────────────
  describe('GET /api/v1/user-types/:id - Get User Type Detail', () => {
    const sampleUserType = {
      id: 1,
      type_name: 'student',
      is_active: true,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
      user_type_fields: [
        {
          field_id: 1,
          is_required: true,
          field_order: 1,
          fields_master: {
            field_name: 'first_name',
            field_label: 'First Name',
            field_type: 'text',
            field_options: null
          }
        }
      ],
      requests: [
        { id: 1, status: 'approved', created_at: new Date('2026-02-01') }
      ]
    };

    test('should return detailed user type with fields and analytics', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue(sampleUserType);

      const response = await request(app)
        .get('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_type).toMatchObject({
        id: 1,
        type_name: 'student',
        is_active: true
      });
      expect(response.body.data.fields).toHaveLength(1);
      expect(response.body.data.fields[0]).toMatchObject({
        field_id: 1,
        field_name: 'first_name',
        is_required: true,
        field_order: 1
      });
      expect(response.body.data.usage_analytics).toMatchObject({
        total_requests: 1,
        status_breakdown: expect.any(Object),
        usage_trend: expect.any(Object)
      });
    });

    test('should return 404 for non-existent user type', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/user-types/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type not found');
    });

    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/v1/user-types/abc')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid user type ID');
    });

    test('should return 400 for negative ID', async () => {
      const response = await request(app)
        .get('/api/v1/user-types/-1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/user-types/fields-master
  // ───────────────────────────────────────────────
  describe('GET /api/v1/user-types/fields-master - Get Available Fields', () => {
    const sampleFields = [
      { id: 1, field_name: 'email', field_label: 'Email', field_type: 'email', field_options: null },
      { id: 2, field_name: 'first_name', field_label: 'First Name', field_type: 'text', field_options: null },
      { id: 3, field_name: 'phone', field_label: 'Phone', field_type: 'tel', field_options: null }
    ];

    test('should return all available fields', async () => {
      mockPrisma.fields_master.findMany.mockResolvedValue(sampleFields);

      const response = await request(app)
        .get('/api/v1/user-types/fields-master')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fields).toHaveLength(3);
      expect(response.body.data.count).toBe(3);
    });

    test('should return fields sorted by field_name', async () => {
      mockPrisma.fields_master.findMany.mockResolvedValue(sampleFields);

      await request(app)
        .get('/api/v1/user-types/fields-master')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.fields_master.findMany).toHaveBeenCalledWith({
        orderBy: { field_name: 'asc' }
      });
    });

    test('should return 404 when no fields exist', async () => {
      mockPrisma.fields_master.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/user-types/fields-master')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No fields available');
    });
  });

  // ───────────────────────────────────────────────
  // POST /api/v1/user-types
  // ───────────────────────────────────────────────
  describe('POST /api/v1/user-types - Create User Type', () => {
    const validBody = {
      type_name: 'contractor',
      selectedFields: [
        { field_id: 1, is_required: true, field_order: 1 },
        { field_id: 2, is_required: false, field_order: 2 }
      ]
    };

    test('should create a new user type successfully', async () => {
      mockPrisma.user_types.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.fields_master.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          user_types: {
            create: jest.fn().mockResolvedValue({
              id: 3,
              type_name: 'contractor',
              is_active: true,
              created_at: new Date()
            })
          },
          user_type_fields: {
            createMany: jest.fn().mockResolvedValue({ count: 2 })
          }
        });
      });

      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBody)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User type created successfully');
      expect(response.body.data).toMatchObject({
        user_type_id: 3,
        type_name: 'contractor',
        is_active: true,
        fields_count: 2
      });
    });

    test('should reject duplicate user type name', async () => {
      mockPrisma.user_types.findFirst.mockResolvedValue({ id: 1, type_name: 'contractor' });

      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details.type_name).toBe('User type name already exists');
    });

    test('should reject empty type_name', async () => {
      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ type_name: '', selectedFields: [{ field_id: 1, is_required: true, field_order: 1 }] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject missing selectedFields', async () => {
      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ type_name: 'test_type' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject empty selectedFields array', async () => {
      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ type_name: 'test_type', selectedFields: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject type_name with special characters', async () => {
      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ type_name: 'invalid type!', selectedFields: [{ field_id: 1, is_required: true, field_order: 1 }] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject duplicate field_order values', async () => {
      mockPrisma.user_types.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          type_name: 'test_type',
          selectedFields: [
            { field_id: 1, is_required: true, field_order: 1 },
            { field_id: 2, is_required: false, field_order: 1 }
          ]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details.selectedFields).toContain('unique');
    });

    test('should reject invalid field IDs', async () => {
      mockPrisma.user_types.findFirst.mockResolvedValue(null);
      mockPrisma.fields_master.findMany.mockResolvedValue([{ id: 1 }]); // only 1 of 2 found

      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details.selectedFields).toContain('do not exist');
    });
  });

  // ───────────────────────────────────────────────
  // PUT /api/v1/user-types/:id
  // ───────────────────────────────────────────────
  describe('PUT /api/v1/user-types/:id - Update User Type', () => {
    const updateBody = {
      type_name: 'student_v2',
      selectedFields: [
        { field_id: 1, is_required: true, field_order: 1 },
        { field_id: 3, is_required: false, field_order: 2 }
      ]
    };

    test('should update user type successfully', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1,
        type_name: 'student',
        is_active: true,
        user_type_fields: [{ field_id: 1 }, { field_id: 2 }]
      });
      mockPrisma.user_types.findFirst.mockResolvedValue(null); // no duplicate name

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          user_types: {
            update: jest.fn().mockResolvedValue({
              id: 1,
              type_name: 'student_v2',
              is_active: true,
              updated_at: new Date()
            })
          },
          user_type_fields: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 })
          }
        });
      });

      const response = await request(app)
        .put('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User type updated successfully');
      expect(response.body.data.type_name).toBe('student_v2');
      expect(response.body.data.changes).toMatchObject({
        name_changed: true,
        fields_added: expect.any(Number),
        fields_removed: expect.any(Number)
      });
    });

    test('should return 404 when updating non-existent user type', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/user-types/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateBody)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User type not found');
    });

    test('should reject duplicate name when updating', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1,
        type_name: 'student',
        user_type_fields: []
      });
      mockPrisma.user_types.findFirst.mockResolvedValue({ id: 2, type_name: 'student_v2' });

      const response = await request(app)
        .put('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateBody)
        .expect(400);

      expect(response.body.details.type_name).toBe('User type name already exists');
    });

    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .put('/api/v1/user-types/abc')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateBody)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/user-types/:id/delete-info
  // ───────────────────────────────────────────────
  describe('GET /api/v1/user-types/:id/delete-info - Deletion Impact', () => {
    test('should return deletion impact information', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1,
        type_name: 'student',
        is_active: true,
        created_at: new Date('2026-01-01'),
        requests: [
          { id: 1, status: 'pending', created_at: new Date('2026-02-07') },
          { id: 2, status: 'approved', created_at: new Date('2026-01-15') }
        ]
      });
      mockPrisma.user_types.count.mockResolvedValue(2); // other active types

      const response = await request(app)
        .get('/api/v1/user-types/1/delete-info')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_type.type_name).toBe('student');
      expect(response.body.data.usage_statistics).toMatchObject({
        total_requests: 2,
        active_requests: 1
      });
      expect(response.body.data.safety_check).toMatchObject({
        is_last_user_type: false,
        concurrent_edits: false
      });
    });

    test('should flag when it is the last active user type', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1,
        type_name: 'student',
        is_active: true,
        created_at: new Date(),
        requests: []
      });
      mockPrisma.user_types.count.mockResolvedValue(0); // no other active types

      const response = await request(app)
        .get('/api/v1/user-types/1/delete-info')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.data.safety_check.is_last_user_type).toBe(true);
    });

    test('should return 404 for non-existent user type', async () => {
      mockPrisma.user_types.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/user-types/999/delete-info')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // DELETE /api/v1/user-types/:id
  // ───────────────────────────────────────────────
  describe('DELETE /api/v1/user-types/:id - Delete User Type', () => {
    test('should soft-delete user type with confirmation', async () => {
      mockPrisma.user_types.count.mockResolvedValue(2); // not last type
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 1,
        type_name: 'contractor',
        is_active: true,
        requests: [{ id: 1, status: 'approved', created_at: new Date() }]
      });
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          user_types: {
            update: jest.fn().mockResolvedValue({
              id: 1,
              type_name: 'contractor',
              is_active: false,
              updated_at: new Date()
            })
          },
          user_type_fields: {
            deleteMany: jest.fn().mockResolvedValue({ count: 3 })
          }
        });
      });

      const response = await request(app)
        .delete('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User type deleted successfully');
      expect(response.body.data.deletion_type).toBe('soft_delete');
      expect(response.body.summary.existing_requests_preserved).toBe(true);
    });

    test('should reject deletion without confirmation', async () => {
      const response = await request(app)
        .delete('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Deletion must be confirmed');
    });

    test('should prevent deleting last active user type', async () => {
      mockPrisma.user_types.count.mockResolvedValue(0); // last type

      const response = await request(app)
        .delete('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot delete last user type');
      expect(response.body.details.reason).toBe('system_requires_minimum_one_type');
    });

    test('should return 404 when deleting non-existent user type', async () => {
      mockPrisma.user_types.count.mockResolvedValue(2);
      mockPrisma.user_types.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/user-types/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // PUT /api/v1/user-types/:id/status
  // ───────────────────────────────────────────────
  describe('PUT /api/v1/user-types/:id/status - Toggle Status', () => {
    test('should deactivate a user type', async () => {
      mockPrisma.user_types.count.mockResolvedValue(2); // not last active
      mockPrisma.user_types.update.mockResolvedValue({
        id: 1,
        type_name: 'student',
        is_active: false,
        updated_at: new Date()
      });

      const response = await request(app)
        .put('/api/v1/user-types/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ is_active: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User type deactivated successfully');
      expect(response.body.data.is_active).toBe(false);
    });

    test('should activate a user type', async () => {
      mockPrisma.user_types.update.mockResolvedValue({
        id: 1,
        type_name: 'student',
        is_active: true,
        updated_at: new Date()
      });

      const response = await request(app)
        .put('/api/v1/user-types/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ is_active: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User type activated successfully');
      expect(response.body.data.is_active).toBe(true);
    });

    test('should prevent deactivating last active user type', async () => {
      mockPrisma.user_types.count.mockResolvedValue(0); // no other active

      const response = await request(app)
        .put('/api/v1/user-types/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ is_active: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot deactivate last user type');
    });

    test('should reject non-boolean is_active value', async () => {
      const response = await request(app)
        .put('/api/v1/user-types/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ is_active: 'yes' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid status value');
    });

    test('should reject missing is_active field', async () => {
      const response = await request(app)
        .put('/api/v1/user-types/1/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // Full CRUD Flow
  // ───────────────────────────────────────────────
  describe('Full CRUD Flow', () => {
    test('should complete create → read → update → deactivate → delete flow', async () => {
      // Step 1: Create
      mockPrisma.user_types.findFirst.mockResolvedValue(null);
      mockPrisma.fields_master.findMany.mockResolvedValue([{ id: 1 }]);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        return cb({
          user_types: {
            create: jest.fn().mockResolvedValue({
              id: 5, type_name: 'vendor', is_active: true, created_at: new Date()
            }),
            update: jest.fn().mockResolvedValue({
              id: 5, type_name: 'vendor', is_active: false, updated_at: new Date()
            })
          },
          user_type_fields: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 })
          }
        });
      });

      const createRes = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ type_name: 'vendor', selectedFields: [{ field_id: 1, is_required: true, field_order: 1 }] })
        .expect(201);

      expect(createRes.body.data.type_name).toBe('vendor');

      // Step 2: Read
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 5, type_name: 'vendor', is_active: true,
        created_at: new Date(), updated_at: new Date(),
        user_type_fields: [{ field_id: 1, is_required: true, field_order: 1, fields_master: { field_name: 'name', field_label: 'Name', field_type: 'text', field_options: null } }],
        requests: []
      });

      const readRes = await request(app)
        .get('/api/v1/user-types/5')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(readRes.body.data.user_type.type_name).toBe('vendor');

      // Step 3: Toggle status
      mockPrisma.user_types.count.mockResolvedValue(3);
      mockPrisma.user_types.update.mockResolvedValue({
        id: 5, type_name: 'vendor', is_active: false, updated_at: new Date()
      });

      const statusRes = await request(app)
        .put('/api/v1/user-types/5/status')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ is_active: false })
        .expect(200);

      expect(statusRes.body.data.is_active).toBe(false);

      // Step 4: Delete
      mockPrisma.user_types.count.mockResolvedValue(2);
      mockPrisma.user_types.findUnique.mockResolvedValue({
        id: 5, type_name: 'vendor', is_active: false, requests: []
      });

      const deleteRes = await request(app)
        .delete('/api/v1/user-types/5')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(200);

      expect(deleteRes.body.data.deletion_type).toBe('soft_delete');
    });
  });

  // ───────────────────────────────────────────────
  // Error Handling
  // ───────────────────────────────────────────────
  describe('Error Handling', () => {
    test('should return 500 when database throws on list', async () => {
      mockPrisma.user_types.findMany.mockRejectedValue(new Error('DB connection lost'));

      const response = await request(app)
        .get('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve user types');
    });

    test('should return 500 when database throws on detail', async () => {
      mockPrisma.user_types.findUnique.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/v1/user-types/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should return 500 when transaction fails on create', async () => {
      mockPrisma.user_types.findFirst.mockResolvedValue(null);
      mockPrisma.fields_master.findMany.mockResolvedValue([{ id: 1 }]);
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const response = await request(app)
        .post('/api/v1/user-types')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ type_name: 'test_type', selectedFields: [{ field_id: 1, is_required: true, field_order: 1 }] })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to create user type');
    });
  });
});
