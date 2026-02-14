// Mock Prisma methods
const mockPrisma = {
  fields_master: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  },
  user_type_fields: {
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
    Object.values(mockPrisma.fields_master).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.user_type_fields).forEach(mock => mock.mockReset());

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
          field_name: 'full_name',
          field_label: 'الاسم الكامل',
          field_type: 'text',
          field_options: null,
          created_at: new Date('2026-01-15'),
          updated_at: new Date('2026-01-15'),
          user_type_fields: [
            {
              is_required: true,
              field_order: 1,
              user_type: { id: 1, type_name: 'student', is_active: true }
            },
            {
              is_required: false,
              field_order: 2,
              user_type: { id: 2, type_name: 'agent', is_active: false }
            }
          ]
        }
      ];

      mockPrisma.fields_master.findMany.mockResolvedValue(mockFields);
      mockPrisma.fields_master.count.mockResolvedValue(1);
      mockPrisma.fields_master.groupBy.mockResolvedValue([
        { field_type: 'text', _count: { id: 1 } }
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
      mockPrisma.fields_master.findMany.mockResolvedValue([]);
      mockPrisma.fields_master.count.mockResolvedValue(0);
      mockPrisma.fields_master.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fields_master.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { field_name: { contains: 'email', mode: 'insensitive' } },
              { field_label: { contains: 'email', mode: 'insensitive' } }
            ])
          })
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should apply field_type filter', async () => {
      mockReq.query = { field_type: 'dropdown' };
      mockPrisma.fields_master.findMany.mockResolvedValue([]);
      mockPrisma.fields_master.count.mockResolvedValue(0);
      mockPrisma.fields_master.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fields_master.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            field_type: 'dropdown'
          })
        })
      );
    });

    test('should sort by name descending', async () => {
      mockReq.query = { sort: 'name', order: 'desc' };
      mockPrisma.fields_master.findMany.mockResolvedValue([]);
      mockPrisma.fields_master.count.mockResolvedValue(0);
      mockPrisma.fields_master.groupBy.mockResolvedValue([]);

      await getFieldsMaster(mockReq, mockRes);

      expect(mockPrisma.fields_master.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field_name: 'desc' }
        })
      );
    });

    test('should return empty list when no fields exist', async () => {
      mockPrisma.fields_master.findMany.mockResolvedValue([]);
      mockPrisma.fields_master.count.mockResolvedValue(0);
      mockPrisma.fields_master.groupBy.mockResolvedValue([]);

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
        field_name: 'email',
        field_label: 'البريد الإلكتروني',
        field_type: 'email',
        field_options: null,
        created_at: new Date('2026-01-15'),
        updated_at: new Date('2026-01-15'),
        user_type_fields: [
          {
            id: 10,
            is_required: true,
            field_order: 3,
            user_type: { id: 1, type_name: 'student', is_active: true }
          }
        ]
      };

      mockReq.params = { id: '1' };
      mockPrisma.fields_master.findUnique.mockResolvedValue(mockField);

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
    Object.values(mockPrisma.fields_master).forEach(mock => mock.mockReset());
    Object.values(mockPrisma.user_type_fields).forEach(mock => mock.mockReset());

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
      mockPrisma.fields_master.findMany.mockRejectedValue(new Error('DB connection lost'));
      mockPrisma.fields_master.count.mockRejectedValue(new Error('DB connection lost'));

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
      mockPrisma.fields_master.findUnique.mockResolvedValue(null);

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
      mockPrisma.fields_master.findUnique.mockRejectedValue(new Error('Connection timeout'));

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
