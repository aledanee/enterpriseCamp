const axios = require('axios');
const logger = require('./logger');

/**
 * Tamra WhatsApp API Service
 * API Docs: https://tamra.ibrahimihsan.site/api/v1/external
 */

const TAMRA_BASE_URL = process.env.TAMRA_BASE_URL || 'https://tamra.ibrahimihsan.site/api/v1/external';
const TAMRA_API_KEY = process.env.TAMRA_API_KEY;

const client = axios.create({
  baseURL: TAMRA_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': TAMRA_API_KEY,
  },
});

/**
 * Normalize a phone number to international format
 * Handles Saudi numbers: removes leading 0, adds +966 if needed
 * @param {string} phone
 * @returns {string}
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // Saudi-specific: 05xxxxxxxx → +9665xxxxxxxx
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    cleaned = '+966' + cleaned.slice(1);
  }

  // If starts with 5 and is 9 digits (Saudi without country code)
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    cleaned = '+966' + cleaned;
  }

  // Ensure + prefix
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};

/**
 * Send a WhatsApp message via Tamra API
 * @param {string} phone - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<object>}
 */
const sendWhatsApp = async (phone, message) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    logger.warn('WhatsApp send skipped — invalid phone', { action: 'whatsapp_skip', phone });
    return { success: false, error: 'Invalid phone number' };
  }

  if (!TAMRA_API_KEY) {
    logger.warn('WhatsApp send skipped — TAMRA_API_KEY not configured', { action: 'whatsapp_skip' });
    return { success: false, error: 'API key not configured' };
  }

  try {
    const response = await client.post('/messages/send', {
      phone: normalizedPhone,
      message,
    });

    logger.info('WhatsApp message sent successfully', {
      action: 'whatsapp_sent',
      phone: normalizedPhone,
      responseId: response.data?.id || response.data?.messageId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: response.data };
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    logger.error('Failed to send WhatsApp message', {
      action: 'whatsapp_send_failed',
      phone: normalizedPhone,
      status: error.response?.status,
      error: errMsg,
      timestamp: new Date().toISOString(),
    });

    return { success: false, error: errMsg };
  }
};

/**
 * Build a status-change WhatsApp message (plain text, Arabic)
 */
const buildStatusWhatsApp = (requestId, typeName, status, adminNotes) => {
  const statusAr = status === 'approved' ? '✅ مقبول' : '❌ مرفوض';
  let msg = `*نظام LesOne*\n\n`;
  msg += `مرحباً، تم تحديث حالة طلبك:\n\n`;
  msg += `📋 *رقم الطلب:* #${requestId}\n`;
  msg += `📁 *نوع الطلب:* ${typeName}\n`;
  msg += `📌 *الحالة:* ${statusAr}\n`;

  if (adminNotes) {
    msg += `\n💬 *ملاحظات الإدارة:*\n${adminNotes}\n`;
  }

  msg += `\n_هذه رسالة تلقائية من نظام LesOne._`;
  return msg;
};

module.exports = { sendWhatsApp, buildStatusWhatsApp, normalizePhone };
