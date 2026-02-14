const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock Prisma
const mockPrisma = {
  user_types: {
    count: jest.fn()
  },
  fields_master: {
    count: jest.fn()
  },
  user_type_fields: {
    count: jest.fn()
  },
  requests: {
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

// Mock child_process and fs for backup/restore
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

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

const databaseRouter = require('../../src/features/database/router');

describe('Database Integration Tests', () => {
  let app;
  let validToken;
  const JWT_SECRET = 'test-integration-jwt-secret';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    validToken = jwt.sign(
      { email: 'admin@lesone.com', role: 'admin', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/v1/database', databaseRouter);
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────
  // Authentication Guard
  // ───────────────────────────────────────────────
  describe('Authentication Guard', () => {
    test('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/database/health')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/database/health
  // ───────────────────────────────────────────────
  describe('GET /api/v1/database/health - Health Check', () => {
    test('should return healthy status when database is operating normally', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ '?column?': 1 }])  // SELECT 1
        .mockResolvedValueOnce([{ version: 'PostgreSQL 16.1' }])  // version
        .mockResolvedValueOnce([{ size: '12 MB' }])  // db size
        .mockResolvedValueOnce([{ count: 5n }])  // active connections
        .mockResolvedValueOnce([{ max_connections: '100' }])  // max connections
        .mockResolvedValueOnce([  // tables
          { tablename: 'requests', total_size: '8192 bytes' },
          { tablename: 'user_types', total_size: '4096 bytes' }
        ]);

      const response = await request(app)
        .get('/api/v1/database/health')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.database).toMatchObject({
        version: 'PostgreSQL 16.1',
        name: 'testdb',
        size: '12 MB'
      });
      expect(response.body.data.connections).toHaveProperty('active');
      expect(response.body.data.connections).toHaveProperty('max');
      expect(response.body.data.tables).toHaveLength(2);
    });

    test('should return 503 when database is unreachable', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/v1/database/health')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/database/stats
  // ───────────────────────────────────────────────
  describe('GET /api/v1/database/stats - Statistics', () => {
    test('should return comprehensive database statistics', async () => {
      mockPrisma.user_types.count
        .mockResolvedValueOnce(3)   // total
        .mockResolvedValueOnce(2);  // active

      mockPrisma.fields_master.count.mockResolvedValue(15);
      mockPrisma.user_type_fields.count.mockResolvedValue(25);

      mockPrisma.requests.count
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(10)  // pending
        .mockResolvedValueOnce(35)  // approved
        .mockResolvedValueOnce(5)   // rejected
        .mockResolvedValueOnce(3)   // 24h
        .mockResolvedValueOnce(15)  // 7d
        .mockResolvedValueOnce(40); // 30d

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ size: '12 MB' }])
        .mockResolvedValueOnce([
          { tablename: 'requests', total_size: '8 MB', raw_size: 8388608n }
        ]);

      mockPrisma.requests.groupBy.mockResolvedValue([
        { user_type_id: 1, _count: { id: 30 } },
        { user_type_id: 2, _count: { id: 20 } }
      ]);

      mockPrisma.user_types.findMany = jest.fn().mockResolvedValue([
        { id: 1, type_name: 'student' },
        { id: 2, type_name: 'agent' }
      ]);

      const response = await request(app)
        .get('/api/v1/database/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tables.user_types).toMatchObject({
        total: 3,
        active: 2,
        inactive: 1
      });
      expect(response.body.data.tables.requests).toMatchObject({
        total: 50,
        pending: 10,
        approved: 35,
        rejected: 5
      });
      expect(response.body.data.activity).toMatchObject({
        requests_last_24h: 3,
        requests_last_7d: 15,
        requests_last_30d: 40
      });
    });
  });

  // ───────────────────────────────────────────────
  // GET /api/v1/database/backups
  // ───────────────────────────────────────────────
  describe('GET /api/v1/database/backups - List Backups', () => {
    test('should return list of backup files', async () => {
      const fs = require('fs');
      
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue([
        'backup_2026-02-14T10-30-00-000Z.sql',
        'backup_2026-02-13T08-00-00-000Z.sql'
      ]);
      fs.promises.stat
        .mockResolvedValueOnce({
          size: 262144,
          birthtime: new Date('2026-02-14T10:30:00Z'),
          mtime: new Date('2026-02-14T10:30:00Z')
        })
        .mockResolvedValueOnce({
          size: 131072,
          birthtime: new Date('2026-02-13T08:00:00Z'),
          mtime: new Date('2026-02-13T08:00:00Z')
        });

      const response = await request(app)
        .get('/api/v1/database/backups')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backups).toHaveLength(2);
      expect(response.body.data.metadata.total_backups).toBe(2);
    });

    test('should return empty list when no backups exist', async () => {
      const fs = require('fs');
      
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/database/backups')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backups).toHaveLength(0);
      expect(response.body.data.metadata.total_backups).toBe(0);
    });
  });

  // ───────────────────────────────────────────────
  // POST /api/v1/database/restore/:filename
  // ───────────────────────────────────────────────
  describe('POST /api/v1/database/restore/:filename - Restore', () => {
    test('should reject restoration without confirmation', async () => {
      const response = await request(app)
        .post('/api/v1/database/restore/backup_test.sql')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Restoration must be confirmed');
    });

    test('should reject filename with directory traversal', async () => {
      const response = await request(app)
        .post('/api/v1/database/restore/..%2F..%2Fetc%2Fpasswd')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────
  // DELETE /api/v1/database/backup/:filename
  // ───────────────────────────────────────────────
  describe('DELETE /api/v1/database/backup/:filename - Delete Backup', () => {
    test('should reject deletion without confirmation', async () => {
      const response = await request(app)
        .delete('/api/v1/database/backup/backup_test.sql')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Deletion must be confirmed');
    });

    test('should return 404 for non-existent backup file', async () => {
      const fs = require('fs');
      fs.promises.access.mockRejectedValue(new Error('ENOENT'));

      const response = await request(app)
        .delete('/api/v1/database/backup/nonexistent.sql')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Backup file not found');
    });

    test('should delete backup file successfully', async () => {
      const fs = require('fs');
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.stat.mockResolvedValue({
        size: 262144,
        birthtime: new Date('2026-02-14'),
        mtime: new Date('2026-02-14')
      });
      fs.promises.unlink.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/v1/database/backup/backup_test.sql')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ confirmed: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Backup file deleted successfully');
    });
  });
});
