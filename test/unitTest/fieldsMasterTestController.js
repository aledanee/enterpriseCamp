// Mock Prisma methods
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

// Mock dependencies
jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const { getFieldsMaster, getFieldDetail } = require('../../src/features/fields-master/controllers');
const logger = require('../../src/shared/services/logger');

describe('Fields Master Controllers - Happy Path Scenarios', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.fieldsMaster).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.userTypeField).forEach(mock => mock.mockReset());

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

  describe('getFieldsMaster - Happy Path', () => {
    test('should return paginated fields with usage statistics', async () => {
      const mockFields = [
        {
          id: 1,
          fieldName: 'full_name',
          fieldLabel: 'الاسم الكامل',
          fieldType: 'text',
          fieldOptions: null,
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-01-15'),
          userTypeFields: [
            {
              isRequired: true,
              fieldOrder: 1,
              userType: { id: 1, typeName: 'student', isActive: true }
            },
            {
              isRequired: false,
              fieldOrder: 2,
              userType: { id: 2, typeName: 'agent', isActive: false }
            }
          ]
        }
      ];

      mockPrisma.fieldsMaster.findMany.mockResolvedValue(mockFields);
      mockPrisma.fieldsMaster.count.mockResolvedValue(1);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([
        { fieldType: 'text', _count: { id: 1 } }
      ]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                id: 1,
                field_name: 'full_name',
                usage: expect.objectContaining({
                  total_user_types: 2,
                  active_user_types: 1
                })
              })
            ]),
            metadata: expect.objectContaining({
              total_count: 1,
              page: 1,
              per_page: 25
            })
          })
        })
      );
    });

    test('should apply search filter on field name and label', async () => {
      mockReq.query = { search: 'email' };
      mockPrisma.fieldsMaster.findMany.mockResolvedValue([]);
      mockPrisma.fieldsMaster.count.mockResolvedValue(0);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fieldsMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { fieldName: { contains: 'email', mode: 'insensitive' } },
              { fieldLabel: { contains: 'email', mode: 'insensitive' } }
            ])
          })
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should apply field_type filter', async () => {
      mockReq.query = { field_type: 'dropdown' };
      mockPrisma.fieldsMaster.findMany.mockResolvedValue([]);
      mockPrisma.fieldsMaster.count.mockResolvedValue(0);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fieldsMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fieldType: 'dropdown'
          })
        })
      );
    });

    test('should sort by name descending', async () => {
      mockReq.query = { sort: 'name', order: 'desc' };
      mockPrisma.fieldsMaster.findMany.mockResolvedValue([]);
      mockPrisma.fieldsMaster.count.mockResolvedValue(0);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fieldsMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fieldName: 'desc' }
        })
      );
    });

    test('should return empty list when no fields exist', async () => {
      mockPrisma.fieldsMaster.findMany.mockResolvedValue([]);
      mockPrisma.fieldsMaster.count.mockResolvedValue(0);
      mockPrisma.fieldsMaster.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            fields: [],
            metadata: expect.objectContaining({
              total_count: 0
            })
          })
        })
      );
    });
  });

  describe('getFieldDetail - Happy Path', () => {
    test('should return field detail with usage information', async () => {
      const mockField = {
        id: 1,
        fieldName: 'email',
        fieldLabel: 'البريد الإلكتروني',
        fieldType: 'email',
        fieldOptions: null,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        userTypeFields: [
          {
            id: 10,
            isRequired: true,
            fieldOrder: 3,
            userType: { id: 1, typeName: 'student', isActive: true }
          }
        ]
      };

      mockReq.params = { id: '1' };
      mockPrisma.fieldsMaster.findUnique.mockResolvedValue(mockField);

      await getFieldDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            field: expect.objectContaining({
              id: 1,
              field_name: 'email',
              field_type: 'email'
            })
          })
        })
      );
    });
  });
});

describe('Fields Master Controllers - Error Scenarios', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockPrisma.fieldsMaster).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.userTypeField).forEach(mock => mock.mockReset());

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

  describe('getFieldsMaster - Error Path', () => {
    test('should return 500 when database query fails', async () => {
      mockPrisma.fieldsMaster.findMany.mockRejectedValue(new Error('DB connection lost'));
      mockPrisma.fieldsMaster.count.mockRejectedValue(new Error('DB connection lost'));

      await getFieldsMaster(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getFieldDetail - Error Path', () => {
    test('should return 400 for invalid field ID', async () => {
      mockReq.params = { id: 'abc' };

      await getFieldDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid field ID'
        })
      );
    });

    test('should return 404 when field does not exist', async () => {
      mockReq.params = { id: '999' };
      mockPrisma.fieldsMaster.findUnique.mockResolvedValue(null);

      await getFieldDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Field not found'
        })
      );
    });

    test('should return 500 when database fails for field detail', async () => {
      mockReq.params = { id: '1' };
      mockPrisma.fieldsMaster.findUnique.mockRejectedValue(new Error('Connection timeout'));

      await getFieldDetail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
