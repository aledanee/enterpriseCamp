// Mock Prisma methods
const mockPrisma = {
  userType: {
    count: jest.fn(),
    findMany: jest.fn()
  },
  fieldsMaster: {
    count: jest.fn()
  },
  userTypeField: {
    count: jest.fn()
  },
  request: {
    count: jest.fn(),
    groupBy: jest.fn()
  },
  $queryRaw: jest.fn()
};

jest.mock('../../src/db/prisma', () => mockPrisma);
jest.mock('../../src/shared/services/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

// Mock child_process
const { exec } = require('child_process');
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock fs
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      access: jest.fn(),
      mkdir: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
      unlink: jest.fn()
    }
  };
});

const {
  createBackup,
  restoreBackup,
  getDatabaseHealth,
  getDatabaseStats,
  getBackups,
  deleteBackup
} = require('../../src/features/database/controllers');
const logger = require('../../src/shared/services/logger');
const fs = require('fs');

describe('Database Controllers - Happy Path Scenarios', () => {
  let mockReq, mockRes;

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  });

  afterAll(() => {
    delete process.env.DATABASE_URL;
  });

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

  // ───────────────────────────────────────────────
  // getDatabaseHealth
  // ───────────────────────────────────────────────
  describe('getDatabaseHealth - Happy Path', () => {
    test('should return healthy database status', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ '?column?': 1 }])            // SELECT 1
        .mockResolvedValueOnce([{ version: 'PostgreSQL 16' }])  // version
        .mockResolvedValueOnce([{ size: '12 MB' }])             // db size
        .mockResolvedValueOnce([{ count: 5n }])                 // connections
        .mockResolvedValueOnce([{ max_connections: '100' }])    // max connections
        .mockResolvedValueOnce([{ tablename: 'requests', total_size: '8 KB' }]); // tables

      await getDatabaseHealth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'healthy',
            database: expect.objectContaining({
              version: 'PostgreSQL 16',
              name: 'testdb',
              size: '12 MB'
            }),
            connections: expect.objectContaining({
              active: 5,
              max: 100
            })
          })
        })
      );
      expect(logger.info).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────
  // getDatabaseStats
  // ───────────────────────────────────────────────
  describe('getDatabaseStats - Happy Path', () => {
    test('should return comprehensive database statistics', async () => {
      mockPrisma.userType.count
        .mockResolvedValueOnce(3)   // total
        .mockResolvedValueOnce(2);  // active

      mockPrisma.fieldsMaster.count.mockResolvedValue(15);
      mockPrisma.userTypeField.count.mockResolvedValue(25);

      mockPrisma.request.count
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(10)  // pending
        .mockResolvedValueOnce(35)  // approved
        .mockResolvedValueOnce(5)   // rejected
        .mockResolvedValueOnce(3)   // 24h
        .mockResolvedValueOnce(15)  // 7d
        .mockResolvedValueOnce(40); // 30d

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ size: '12 MB' }])
        .mockResolvedValueOnce([{ tablename: 'requests', total_size: '8 MB', raw_size: 8388608n }]);

      mockPrisma.request.groupBy.mockResolvedValue([
        { userTypeId: 1, _count: { id: 30 } }
      ]);

      mockPrisma.userType.findMany.mockResolvedValue([
        { id: 1, typeName: 'student' }
      ]);

      await getDatabaseStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tables: expect.objectContaining({
              user_types: { total: 3, active: 2, inactive: 1 },
              requests: { total: 50, pending: 10, approved: 35, rejected: 5 }
            }),
            activity: expect.objectContaining({
              requests_last_24h: 3,
              requests_last_7d: 15,
              requests_last_30d: 40
            }),
            requests_by_type: expect.arrayContaining([
              expect.objectContaining({
                user_type_id: 1,
                type_name: 'student',
                request_count: 30
              })
            ])
          })
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // getBackups
  // ───────────────────────────────────────────────
  describe('getBackups - Happy Path', () => {
    test('should return list of backup files', async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue([
        'backup_2026-02-14.sql',
        'backup_2026-02-13.sql'
      ]);
      fs.promises.stat
        .mockResolvedValueOnce({
          size: 262144,
          birthtime: new Date('2026-02-14'),
          mtime: new Date('2026-02-14')
        })
        .mockResolvedValueOnce({
          size: 131072,
          birthtime: new Date('2026-02-13'),
          mtime: new Date('2026-02-13')
        });

      await getBackups(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            backups: expect.arrayContaining([
              expect.objectContaining({
                filename: expect.stringContaining('backup_'),
                file_size_kb: expect.any(Number)
              })
            ]),
            metadata: expect.objectContaining({
              total_backups: 2
            })
          })
        })
      );
    });

    test('should return empty list when no backups exist', async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue([]);

      await getBackups(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            backups: [],
            metadata: expect.objectContaining({ total_backups: 0 })
          })
        })
      );
    });
  });

  // ───────────────────────────────────────────────
  // deleteBackup
  // ───────────────────────────────────────────────
  describe('deleteBackup - Happy Path', () => {
    test('should delete backup file successfully', async () => {
      mockReq.params = { filename: 'backup_test.sql' };
      mockReq.body = { confirmed: true };

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.stat.mockResolvedValue({
        size: 262144,
        birthtime: new Date('2026-02-14'),
        mtime: new Date('2026-02-14')
      });
      fs.promises.unlink.mockResolvedValue(undefined);

      await deleteBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Backup file deleted successfully',
          data: expect.objectContaining({
            filename: 'backup_test.sql'
          })
        })
      );
      expect(fs.promises.unlink).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────
  // createBackup
  // ───────────────────────────────────────────────
  describe('createBackup - Happy Path', () => {
    test('should create backup successfully via pg_dump', async () => {
      fs.promises.access.mockResolvedValue(undefined);

      // Mock exec callback-style (promisified)
      const execMock = require('child_process').exec;
      execMock.mockImplementation((cmd, opts, callback) => {
        if (typeof opts === 'function') {
          callback = opts;
        }
        callback(null, { stdout: '', stderr: '' });
      });

      fs.promises.stat.mockResolvedValue({
        size: 524288,
        birthtime: new Date(),
        mtime: new Date()
      });

      await createBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Database backup created successfully',
          data: expect.objectContaining({
            filename: expect.stringContaining('backup_'),
            file_size_kb: expect.any(Number)
          })
        })
      );
    });
  });
});

describe('Database Controllers - Error Scenarios', () => {
  let mockReq, mockRes;

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  });

  afterAll(() => {
    delete process.env.DATABASE_URL;
  });

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

  describe('getDatabaseHealth - Error Path', () => {
    test('should return 503 when database is unreachable', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      await getDatabaseHealth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: expect.objectContaining({ status: 'unhealthy' })
        })
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getDatabaseStats - Error Path', () => {
    test('should return 500 when database query fails', async () => {
      mockPrisma.userType.count.mockRejectedValue(new Error('Query failed'));

      await getDatabaseStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  describe('restoreBackup - Error Path', () => {
    test('should return 400 when confirmation is not provided', async () => {
      mockReq.params = { filename: 'backup_test.sql' };
      mockReq.body = { confirmed: false };

      await restoreBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Restoration must be confirmed'
        })
      );
    });

    test('should return 400 for path traversal attempt', async () => {
      mockReq.params = { filename: '../etc/passwd' };
      mockReq.body = { confirmed: true };

      await restoreBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid filename'
        })
      );
    });

    test('should return 404 when backup file not found', async () => {
      mockReq.params = { filename: 'nonexistent.sql' };
      mockReq.body = { confirmed: true };

      fs.promises.access.mockRejectedValue(new Error('ENOENT'));

      await restoreBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Backup file not found'
        })
      );
    });
  });

  describe('deleteBackup - Error Path', () => {
    test('should return 400 when confirmation is not provided', async () => {
      mockReq.params = { filename: 'backup_test.sql' };
      mockReq.body = { confirmed: false };

      await deleteBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Deletion must be confirmed'
        })
      );
    });

    test('should return 400 for path traversal attempt', async () => {
      mockReq.params = { filename: '../../etc/passwd' };
      mockReq.body = { confirmed: true };

      await deleteBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid filename' })
      );
    });

    test('should return 404 when backup file does not exist', async () => {
      mockReq.params = { filename: 'nonexistent.sql' };
      mockReq.body = { confirmed: true };

      fs.promises.access.mockRejectedValue(new Error('ENOENT'));

      await deleteBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Backup file not found' })
      );
    });

    test('should return 500 when unlink fails', async () => {
      mockReq.params = { filename: 'backup_test.sql' };
      mockReq.body = { confirmed: true };

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.stat.mockResolvedValue({
        size: 262144,
        birthtime: new Date(),
        mtime: new Date()
      });
      fs.promises.unlink.mockRejectedValue(new Error('Permission denied'));

      await deleteBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createBackup - Error Path', () => {
    test('should return 500 when pg_dump fails', async () => {
      fs.promises.access.mockResolvedValue(undefined);

      const execMock = require('child_process').exec;
      execMock.mockImplementation((cmd, opts, callback) => {
        if (typeof opts === 'function') {
          callback = opts;
        }
        callback(new Error('pg_dump: command not found'), null);
      });

      await createBackup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to create backup'
        })
      );
    });
  });
});
