const express = require('express');
const router = express.Router();

// Import feature routers
const healthRouter = require('./features/health/router');
const authRouter = require('./features/auth/router');
const userTypesRouter = require('./features/user-types/router');
const fieldsMasterRouter = require('./features/fields-master/router');
const requestsRouter = require('./features/requests/router');
const databaseRouter = require('./features/database/router');

// Mount routes
router.use('/', healthRouter);
router.use('/auth', authRouter);
router.use('/user-types', userTypesRouter);
router.use('/fields-master', fieldsMasterRouter);
router.use('/requests', requestsRouter);
router.use('/database', databaseRouter);

module.exports = router;
