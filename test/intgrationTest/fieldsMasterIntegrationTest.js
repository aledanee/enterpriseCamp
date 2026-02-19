const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock Prisma
const mockPrisma = {
  fieldsMaster: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  },
  userTypeField: {
    findMany: jest.fn()
  }
};

jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const fieldsMasterRouter = require('../../src/features/fields-master/router');

describe('Fields Master Integration Tests', () => {
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
    app.use('/api/v1/fields-master', fieldsMasterRouter);
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.fieldsMaster).forEach(fn => fn.mockReset());
    Object.values(mockPrisma.userTypeField).forEach(fn => fn.mockReset());
  });

  // ───────────────────────────────────────────────
  // Authentication Guard
  // ───────────────────────────────────────────────
  describe('Authentication Guard', () => {
    test('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/fields-master')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/fields-master')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/fields-master
  // ───────────────────────────────────────────────
  describe('GET /api/v1/fields-master - List Fields', () => {
    const sampleFields = [
      {
        id: 1,
        fieldName: 'name',
        fieldLabel: 'الاسم الكامل',
        fieldType: 'text',
        fieldOptions: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        userTypeFields: [
          {
            isRequired: true,
            fieldOrder: 1,
            userType: { id: 1, typeName: 'student', isActive: true }
          }
        ]
      },
      {
        id: 2,
        fieldName: 'email',
        fieldLabel: 'البريد الإلكتروني',
        fieldType: 'email',
        fieldOptions: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        userTypeFields: []
      }
    ];

    test('should return paginated list of fields with usage stats', async () => {
      mockPrisma.fieldsMaster.findMany.mockResolvedValue(sampleFields);
      mockPrisma.fieldsMaster.count.mockResolvedValue(2);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([
        { fieldType: 'text', _count: { id: 1 } },
        { fieldType: 'email', _count: { id: 1 } }
      ]);

      const response = await request(app)
        .get('/api/v1/fields-master')
        .set('Authorization', `Bearer ${validToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fields).toHaveLength(2);
      expect(response.body.data.fields[0]).toMatchObject({
        id: 1,
        field_name: 'name',
        field_type: 'text',
        usage: {
          total_user_types: 1,
          active_user_types: 1
        }
      });
      expect(response.body.data.metadata).toMatchObject({
        total_count: 2,
        page: 1,
        per_page: 25
      });
    });

    test('should handle search and field_type filter', async () => {
      mockPrisma.fieldsMaster.findMany.mockResolvedValue([]);
      mockPrisma.fieldsMaster.count.mockResolvedValue(0);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([]);

      await request(app)
        .get('/api/v1/fields-master?search=email&field_type=email')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockPrisma.fieldsMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { fieldName: { contains: 'email', mode: 'insensitive' } },
              { fieldLabel: { contains: 'email', mode: 'insensitive' } }
            ],
            fieldType: 'email'
          }
        })
      );
    });

    test('should handle empty fields list', async () => {
      mockPrisma.fieldsMaster.findMany.mockResolvedValue([]);
      mockPrisma.fieldsMaster.count.mockResolvedValue(0);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/fields-master')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fields).toHaveLength(0);
      expect(response.body.data.metadata.total_count).toBe(0);
    });

    test('should handle database error gracefully', async () => {
      mockPrisma.fieldsMaster.findMany.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app)
        .get('/api/v1/fields-master')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve fields');
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/fields-master/:id
  // ───────────────────────────────────────────────
  describe('GET /api/v1/fields-master/:id - Field Detail', () => {
    const sampleField = {
      id: 1,
      fieldName: 'name',
      fieldLabel: 'الاسم الكامل',
      fieldType: 'text',
      fieldOptions: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      userTypeFields: [
        {
          isRequired: true,
          fieldOrder: 1,
          userType: { id: 1, typeName: 'student', isActive: true, createdAt: new Date('2026-01-01') }
        },
        {
          isRequired: false,
          fieldOrder: 2,
          userType: { id: 2, typeName: 'agent', isActive: false, createdAt: new Date('2026-01-15') }
        }
      ]
    };

    test('should return field details with usage information', async () => {
      mockPrisma.fieldsMaster.findUnique.mockResolvedValue(sampleField);

      const response = await request(app)
        .get('/api/v1/fields-master/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.field).toMatchObject({
        id: 1,
        field_name: 'name',
        field_type: 'text'
      });
      expect(response.body.data.usage).toMatchObject({
        total_user_types: 2,
        active_user_types: 1,
        inactive_user_types: 1,
        required_in: 1,
        optional_in: 1
      });
    });

    test('should return 404 for non-existent field', async () => {
      mockPrisma.fieldsMaster.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/fields-master/999')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Field not found');
    });

    test('should return 400 for invalid field ID', async () => {
      const response = await request(app)
        .get('/api/v1/fields-master/0')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid field ID');
    });
  });
});
