const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LesOne API',
      version: '1.0.0',
      description: 'Dynamic User Request Management System API',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3220',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Server is running' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 123.456 },
            environment: { type: 'string', example: 'development' },
          },
        },
        DatabaseHealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Database connection is healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            database: { type: 'string', example: 'PostgreSQL' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@lesone.com' },
            password: { type: 'string', example: 'password123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
      },
    },
  },
  apis: ['./src/features/**/*.js', './src/server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
