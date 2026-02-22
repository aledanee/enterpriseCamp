const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../../shared/services/logger');
const prisma = require('../../db/prisma');

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// Backup directory configuration
const BACKUP_DIR = path.join(process.cwd(), 'backups');

/**
 * Ensure backup directory exists
 */
const ensureBackupDir = async () => {
  try {
    await fsPromises.access(BACKUP_DIR);
  } catch {
    await fsPromises.mkdir(BACKUP_DIR, { recursive: true });
  }
};

/**
 * Parse DATABASE_URL to extract connection details
 */
const parseDatabaseUrl = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured');
  }
  
  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1).split('?')[0],
      username: url.username,
      password: url.password
    };
  } catch (error) {
    throw new Error('Invalid DATABASE_URL format');
  }
};

/**
 * Create database backup
 * UC-010 - Admin Create Database Backup
 */
const createBackup = async (req, res) => {
  const startTime = Date.now();
  
  try {
    await ensureBackupDir();
    
    const dbConfig = parseDatabaseUrl();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Use docker exec to run pg_dump inside the PostgreSQL container
    // First try local pg_dump, fallback to docker exec
    const env = { ...process.env, PGPASSWORD: dbConfig.password };

    let command;
    try {
      await execAsync('which pg_dump');
      command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -F p -f "${filePath}"`;
      await execAsync(command, { env, timeout: 120000 });
    } catch {
      // pg_dump not available locally, use docker exec
      const containerName = 'lesone_postgres';
      const dumpCommand = `docker exec -e PGPASSWORD=${dbConfig.password} ${containerName} pg_dump -U ${dbConfig.username} -d ${dbConfig.database} -F p`;
      const { stdout } = await execAsync(dumpCommand, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
      await fsPromises.writeFile(filePath, stdout);
    }

    // Get file stats
    const stats = await fsPromises.stat(filePath);
    const fileSizeKB = Math.round(stats.size / 1024);

    const responseTime = Date.now() - startTime;

    logger.info('Database backup created successfully', {
      action: 'create_backup_success',
      admin_id: req.admin.id,
      filename: filename,
      file_size_kb: fileSizeKB,
      backup_path: filePath,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'Database backup created successfully',
      data: {
        filename: filename,
        file_size_kb: fileSizeKB,
        created_at: new Date().toISOString(),
        backup_path: filePath
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to create database backup', {
      action: 'create_backup_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      message: error.message.includes('pg_dump') 
        ? 'pg_dump command not found. Please ensure PostgreSQL client tools are installed'
        : 'An error occurred while creating the database backup'
    });
  }
};

/**
 * Restore database from backup
 * UC-011 - Admin Restore Database from Backup
 */
const restoreBackup = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { filename } = req.params;
    const { confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Restoration must be confirmed',
        message: 'Please confirm the restoration by setting confirmed: true. WARNING: This will overwrite current data.'
      });
    }

    // Validate filename - prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    // Check if backup file exists
    try {
      await fsPromises.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found',
        message: `Backup file "${filename}" does not exist`
      });
    }

    const dbConfig = parseDatabaseUrl();
    const env = { ...process.env, PGPASSWORD: dbConfig.password };

    let command;
    try {
      await execAsync('which psql');
      command = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${filePath}"`;
      await execAsync(command, { env, timeout: 300000 });
    } catch {
      // psql not available locally, use docker exec with cat piping
      const containerName = 'lesone_postgres';
      command = `cat "${filePath}" | docker exec -i -e PGPASSWORD=${dbConfig.password} ${containerName} psql -U ${dbConfig.username} -d ${dbConfig.database}`;
      await execAsync(command, { timeout: 300000, maxBuffer: 50 * 1024 * 1024 });
    }

    const responseTime = Date.now() - startTime;

    logger.info('Database restored from backup successfully', {
      action: 'restore_backup_success',
      admin_id: req.admin.id,
      filename: filename,
      backup_path: filePath,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Database restored successfully',
      data: {
        filename: filename,
        restored_at: new Date().toISOString()
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to restore database from backup', {
      action: 'restore_backup_failed',
      admin_id: req.admin?.id,
      filename: req.params.filename,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to restore backup',
      message: error.message.includes('psql') 
        ? 'psql command not found. Please ensure PostgreSQL client tools are installed'
        : 'An error occurred while restoring the database'
    });
  }
};

/**
 * Database health check
 * UC-012 - Admin Database Health Check
 */
const getDatabaseHealth = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity
    const connectivityStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const connectivityTime = Date.now() - connectivityStart;

    // Get database version
    const versionResult = await prisma.$queryRaw`SELECT version()`;
    const dbVersion = versionResult[0]?.version || 'Unknown';

    // Get database size
    const dbConfig = parseDatabaseUrl();
    const sizeResult = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
    const dbSize = sizeResult[0]?.size || 'Unknown';

    // Get active connections count
    const connectionsResult = await prisma.$queryRaw`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
    const activeConnections = Number(connectionsResult[0]?.count) || 0;

    // Get max connections
    const maxConnectionsResult = await prisma.$queryRaw`SHOW max_connections`;
    const maxConnections = parseInt(maxConnectionsResult[0]?.max_connections) || 100;

    // Check table health
    const tablesResult = await prisma.$queryRaw`
      SELECT tablename, 
             pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;

    const tables = tablesResult.map(t => ({
      name: t.tablename,
      total_size: t.total_size
    }));

    const responseTime = Date.now() - startTime;

    // Determine health status
    const connectionUsage = (activeConnections / maxConnections) * 100;
    let healthStatus = 'healthy';
    let healthMessage = 'Database is operating normally';

    if (connectivityTime > 1000) {
      healthStatus = 'degraded';
      healthMessage = 'Database responding slowly';
    }
    if (connectionUsage > 80) {
      healthStatus = 'warning';
      healthMessage = 'High connection usage detected';
    }

    logger.info('Database health check completed', {
      action: 'database_health_check',
      admin_id: req.admin.id,
      health_status: healthStatus,
      connectivity_ms: connectivityTime,
      active_connections: activeConnections,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: healthMessage,
      data: {
        status: healthStatus,
        database: {
          version: dbVersion,
          name: dbConfig.database,
          size: dbSize
        },
        connections: {
          active: activeConnections,
          max: maxConnections,
          usage_percentage: Math.round(connectionUsage * 100) / 100
        },
        performance: {
          connectivity_ms: connectivityTime,
          response_time_ms: responseTime
        },
        tables: tables,
        checked_at: new Date().toISOString()
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Database health check failed', {
      action: 'database_health_check_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(503).json({
      success: false,
      error: 'Database health check failed',
      message: 'Unable to connect to database or retrieve health information',
      data: {
        status: 'unhealthy',
        error: error.message,
        checked_at: new Date().toISOString()
      }
    });
  }
};

/**
 * Get database statistics
 * UC-013 - Admin View Database Statistics
 */
const getDatabaseStats = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Get record counts for all tables
    const [
      userTypesCount,
      activeUserTypesCount,
      fieldsCount,
      userTypeFieldsCount,
      requestsCount,
      pendingRequestsCount,
      approvedRequestsCount,
      rejectedRequestsCount
    ] = await Promise.all([
      prisma.userType.count(),
      prisma.userType.count({ where: { isActive: true } }),
      prisma.fieldsMaster.count(),
      prisma.userTypeField.count(),
      prisma.request.count(),
      prisma.request.count({ where: { status: 'pending' } }),
      prisma.request.count({ where: { status: 'approved' } }),
      prisma.request.count({ where: { status: 'rejected' } })
    ]);

    // Get recent activity stats
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [requests24h, requests7d, requests30d] = await Promise.all([
      prisma.request.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.request.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.request.count({ where: { createdAt: { gte: thirtyDaysAgo } } })
    ]);

    // Get database size info
    const sizeResult = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
    const dbSize = sizeResult[0]?.size || 'Unknown';

    // Get table sizes
    const tableSizes = await prisma.$queryRaw`
      SELECT tablename,
             pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
             pg_total_relation_size(schemaname||'.'||tablename) as raw_size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;

    // Get requests per user type breakdown
    const requestsByType = await prisma.request.groupBy({
      by: ['userTypeId'],
      _count: { id: true }
    });

    // Enrich with user type names
    const userTypes = await prisma.userType.findMany({
      select: { id: true, typeName: true }
    });

    const userTypeMap = {};
    userTypes.forEach(ut => { userTypeMap[ut.id] = ut.typeName; });

    const requestsByTypeEnriched = requestsByType.map(item => ({
      user_type_id: item.userTypeId,
      type_name: userTypeMap[item.userTypeId] || 'Deleted Type',
      request_count: item._count.id
    }));

    const responseTime = Date.now() - startTime;

    logger.info('Database statistics retrieved', {
      action: 'get_database_stats',
      admin_id: req.admin.id,
      total_requests: requestsCount,
      total_user_types: userTypesCount,
      total_fields: fieldsCount,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Database statistics retrieved successfully',
      data: {
        tables: {
          user_types: {
            total: userTypesCount,
            active: activeUserTypesCount,
            inactive: userTypesCount - activeUserTypesCount
          },
          fields_master: {
            total: fieldsCount
          },
          user_type_fields: {
            total: userTypeFieldsCount
          },
          requests: {
            total: requestsCount,
            pending: pendingRequestsCount,
            approved: approvedRequestsCount,
            rejected: rejectedRequestsCount
          }
        },
        activity: {
          requests_last_24h: requests24h,
          requests_last_7d: requests7d,
          requests_last_30d: requests30d
        },
        requests_by_type: requestsByTypeEnriched,
        storage: {
          database_size: dbSize,
          tables: tableSizes.map(t => ({
            name: t.tablename,
            size: t.total_size
          }))
        },
        generated_at: new Date().toISOString(),
        response_time_ms: responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to get database statistics', {
      action: 'get_database_stats_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve database statistics',
      message: 'An error occurred while gathering database statistics'
    });
  }
};

/**
 * Get list of backup files
 * UC-014 - Admin View and Manage Backups
 */
const getBackups = async (req, res) => {
  const startTime = Date.now();
  
  try {
    await ensureBackupDir();

    const files = await fsPromises.readdir(BACKUP_DIR);
    const backupFiles = [];

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = await fsPromises.stat(filePath);
        
        backupFiles.push({
          filename: file,
          file_size_kb: Math.round(stats.size / 1024),
          file_size_bytes: stats.size,
          created_at: stats.birthtime.toISOString(),
          modified_at: stats.mtime.toISOString()
        });
      }
    }

    // Sort by creation date descending (newest first)
    backupFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Calculate total storage used
    const totalSizeBytes = backupFiles.reduce((sum, file) => sum + file.file_size_bytes, 0);
    const totalSizeKB = Math.round(totalSizeBytes / 1024);
    const totalSizeMB = Math.round(totalSizeKB / 1024 * 100) / 100;

    const responseTime = Date.now() - startTime;

    logger.info('Backup files listed successfully', {
      action: 'get_backups',
      admin_id: req.admin.id,
      backup_count: backupFiles.length,
      total_size_kb: totalSizeKB,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Backups retrieved successfully',
      data: {
        backups: backupFiles,
        metadata: {
          total_backups: backupFiles.length,
          total_size_kb: totalSizeKB,
          total_size_mb: totalSizeMB,
          backup_directory: BACKUP_DIR
        }
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to list backup files', {
      action: 'get_backups_failed',
      admin_id: req.admin?.id,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve backups',
      message: 'An error occurred while listing backup files'
    });
  }
};

/**
 * Delete a backup file
 * UC-014 - Admin View and Manage Backups (Delete)
 */
const deleteBackup = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { filename } = req.params;
    const { confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Deletion must be confirmed',
        message: 'Please confirm the deletion by setting confirmed: true'
      });
    }

    // Validate filename - prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    // Check if file exists
    try {
      await fsPromises.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found',
        message: `Backup file "${filename}" does not exist`
      });
    }

    // Get file info before deletion
    const stats = await fsPromises.stat(filePath);
    const fileSizeKB = Math.round(stats.size / 1024);

    // Delete the file
    await fsPromises.unlink(filePath);

    const responseTime = Date.now() - startTime;

    logger.info('Backup file deleted successfully', {
      action: 'delete_backup_success',
      admin_id: req.admin.id,
      filename: filename,
      file_size_kb: fileSizeKB,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Backup file deleted successfully',
      data: {
        filename: filename,
        file_size_kb: fileSizeKB,
        deleted_at: new Date().toISOString()
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Failed to delete backup file', {
      action: 'delete_backup_failed',
      admin_id: req.admin?.id,
      filename: req.params.filename,
      error: error.message,
      stack: error.stack,
      response_time_ms: responseTime,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      message: 'An error occurred while deleting the backup file'
    });
  }
};

module.exports = {
  createBackup,
  restoreBackup,
  getDatabaseHealth,
  getDatabaseStats,
  getBackups,
  deleteBackup
};
