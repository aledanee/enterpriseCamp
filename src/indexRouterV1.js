const express = require('express');
const router = express.Router();

// Import feature routers
const healthRouter = require('./features/health/router');
const authRouter = require('./features/auth/router');

// Mount routes
router.use('/', healthRouter);
router.use('/auth', authRouter);

module.exports = router;
