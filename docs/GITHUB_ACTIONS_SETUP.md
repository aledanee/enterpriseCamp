# GitHub Actions Setup for LesOne Project

This document explains how to set up automated testing and merge protection for the LesOne project.

## 🔄 Automated Workflow

The GitHub Actions workflow (`/.github/workflows/test-and-merge.yml`) automatically:

1. **Runs on every Pull Request to `main`**
2. **Tests multiple Node.js versions** (18.x, 20.x)
3. **Runs comprehensive tests:**
   - Unit tests (`test/unitTest/`)
   - Integration tests (`test/intgrationTest/`)
   - Code coverage analysis
   - Security audit
   - Build verification
   - Database connection test

## 🛡️ Branch Protection Setup

To enable automatic merge blocking on test failures, set up branch protection rules:

### Step 1: Go to Repository Settings
1. Navigate to your repository on GitHub
2. Click **Settings** tab
3. Click **Branches** in the left sidebar

### Step 2: Add Branch Protection Rule
1. Click **Add rule**
2. Set **Branch name pattern**: `main`
3. Enable these settings:

#### ✅ Required Settings:
- ☑️ **Require a pull request before merging**
- ☑️ **Require status checks to pass before merging**
- ☑️ **Require branches to be up to date before merging**

#### ✅ Required Status Checks:
Add these required status checks:
- `test (18.x)`
- `test (20.x)`  
- `lint`
- `security`
- `build`
- `database-test`
- `merge-gate`

#### ✅ Additional Protections:
- ☑️ **Restrict pushes that create files that are ignored by these files** 
- ☑️ **Restrict force pushes**
- ☑️ **Require signed commits** (optional but recommended)

### Step 3: Save Protection Rules
Click **Create** to save the branch protection rule.

## 🚀 How It Works

### For Pull Requests:
```
PR Created → GitHub Actions Triggered → Tests Run → Results:
├── ✅ All Pass → Ready to Merge (Green checkmark)
└── ❌ Any Fail → Merge Blocked (Red X, detailed error info)
```

### For Direct Pushes:
```
Push to Main → Tests Run → Results:
├── ✅ All Pass → Push Accepted
└── ❌ Any Fail → Push Rejected
```

## 📊 Test Coverage

The workflow generates test coverage reports:
- **Unit Test Coverage**: `test/unitTest/authTestController.js`
- **Integration Test Coverage**: `test/intgrationTest/authIntegrationTest.js`
- **Combined Coverage Report**: Available in PR comments

## 🔧 Local Development

### Run Tests Locally:
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Specific Files:
```bash
# Run specific unit test
npm test test/unitTest/authTestController.js

# Run specific integration test
npm test test/intgrationTest/authIntegrationTest.js
```

## 🛠️ Environment Variables

The workflow uses these environment variables:
- `ADMIN_EMAIL=admin@lesone.com`
- `ADMIN_PASSWORD=admin123`
- `JWT_SECRET=test-jwt-secret`
- `JWT_EXPIRES_IN=7d`
- `DATABASE_URL=postgresql://...`

## 📋 Test Results

When tests fail, the workflow provides:
- **Detailed error logs**
- **Failed test names**
- **Code coverage changes**
- **Security vulnerability reports**
- **PR comments with results**

## 🎯 Success Criteria

For a PR to be mergeable:
- ✅ All unit tests pass
- ✅ All integration tests pass  
- ✅ No high-severity security vulnerabilities
- ✅ Application builds successfully
- ✅ Database connection works
- ✅ Tests run on multiple Node.js versions

## 🚫 Merge Prevention

PRs will be **automatically blocked** if:
- ❌ Any test fails
- ❌ Security vulnerabilities found
- ❌ Build errors occur
- ❌ Database connection fails

## 📝 PR Comments

The workflow automatically comments on PRs with:
- ✅ **Success**: "All checks passed! Ready to merge"
- ❌ **Failure**: Detailed error information and failed tests

---

This setup ensures that only tested, secure, and working code reaches your main branch! 🎉