require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3220,
  
  db: {
    url: process.env.DATABASE_URL,
  },
  
  admin: {
    email: process.env.ADMIN_EMAIL,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  email: {
    smtpEmail: process.env.SMTP_EMAIL,
    smtpAppPassword: process.env.SMTP_APP_PASSWORD,
  },

  whatsapp: {
    tamraBaseUrl: process.env.TAMRA_BASE_URL || 'https://tamra.ibrahimihsan.site/api/v1/external',
    tamraApiKey: process.env.TAMRA_API_KEY,
  },
};

module.exports = config;
