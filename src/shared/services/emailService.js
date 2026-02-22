const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Gmail SMTP Email Service
 * Uses App Password authentication
 */

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify().then(() => {
  logger.info('Email service connected successfully', { action: 'email_service_ready' });
}).catch((err) => {
  logger.error('Email service connection failed', { action: 'email_service_error', error: err.message });
});

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 * @returns {Promise<object>}
 */
const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"LesOne نظام الطلبات" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
    });

    logger.info('Email sent successfully', {
      action: 'email_sent',
      to,
      subject,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email', {
      action: 'email_send_failed',
      to,
      subject,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    return { success: false, error: error.message };
  }
};

/**
 * Build a status-change notification email
 */
const buildStatusEmail = (requestId, typeName, status, adminNotes) => {
  const isApproved = status === 'approved';
  const statusAr = isApproved ? 'مقبول ✅' : 'مرفوض ❌';
  const color = isApproved ? '#00e676' : '#ff5252';
  const bgColor = isApproved ? '#e8f5e9' : '#ffebee';

  const notesSection = adminNotes
    ? `<tr><td style="padding:12px 20px;color:#555;font-size:14px;">
         <strong>ملاحظات الإدارة:</strong><br/>${adminNotes}
       </td></tr>`
    : '';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#6C63FF,#8b7fff);padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">LesOne</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">نظام إدارة الطلبات</p>
      </td>
    </tr>
    <!-- Status badge -->
    <tr>
      <td style="padding:24px 20px 12px;text-align:center;">
        <div style="display:inline-block;background:${bgColor};color:${color};padding:8px 24px;border-radius:20px;font-weight:700;font-size:16px;border:1px solid ${color}33;">
          ${statusAr}
        </div>
      </td>
    </tr>
    <!-- Details -->
    <tr>
      <td style="padding:12px 20px;text-align:center;color:#333;font-size:15px;">
        <p style="margin:0 0 8px;">تم تحديث حالة طلبك رقم <strong style="color:#6C63FF;">#${requestId}</strong></p>
        <p style="margin:0;color:#888;font-size:13px;">نوع الطلب: <strong>${typeName}</strong></p>
      </td>
    </tr>
    ${notesSection}
    <!-- Footer -->
    <tr>
      <td style="padding:20px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;color:#aaa;font-size:11px;">هذا بريد إلكتروني تلقائي من نظام LesOne — لا تقم بالرد عليه.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = { sendEmail, buildStatusEmail };
