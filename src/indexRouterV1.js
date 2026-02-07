const express = require('express');
const router = express.Router();

// Import feature routers
const healthRouter = require('./features/health/router');
const authRouter = require('./features/auth/router');
const userTypesRouter = require('./features/user-types/router');

// Mount routes
router.use('/', healthRouter);
router.use('/auth', authRouter);
router.use('/user-types', userTypesRouter);

module.exports = router;
