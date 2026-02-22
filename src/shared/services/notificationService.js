const { sendEmail, buildStatusEmail } = require('./emailService');
const { sendWhatsApp, buildStatusWhatsApp } = require('./whatsappService');
const logger = require('./logger');

/**
 * Unified Notification Service
 * Sends both Email + WhatsApp notifications for request status changes.
 *
 * Extracts contact info from the request's dynamic `data` JSONB field.
 * Looks for fields of type "email" and "tel" in the form data.
 */

/**
 * Try to extract email and phone from request data (JSONB).
 * Field keys vary per user type, so we search by common patterns.
 *
 * @param {object} requestData - The JSONB `data` object from the request
 * @param {Array} fields - Optional array of FieldsMaster entries for the user type
 * @returns {{ email: string|null, phone: string|null }}
 */
const extractContactInfo = (requestData, fields = []) => {
  let email = null;
  let phone = null;

  if (!requestData || typeof requestData !== 'object') {
    return { email, phone };
  }

  // Strategy 1: Use field definitions to find email/tel type fields
  if (fields.length > 0) {
    for (const field of fields) {
      const value = requestData[field.fieldName];
      if (!value) continue;

      if (field.fieldType === 'email' && !email) {
        email = value;
      }
      if (field.fieldType === 'tel' && !phone) {
        phone = String(value);
      }
    }
  }

  // Strategy 2: Fallback — search by key names
  if (!email || !phone) {
    const entries = Object.entries(requestData);
    for (const [key, value] of entries) {
      if (!value) continue;
      const keyLower = key.toLowerCase();

      if (!email && (keyLower.includes('email') || keyLower.includes('بريد'))) {
        email = value;
      }
      if (!phone && (keyLower.includes('phone') || keyLower.includes('tel') || keyLower.includes('mobile') || keyLower.includes('هاتف') || keyLower.includes('جوال'))) {
        phone = String(value);
      }
    }
  }

  // Strategy 3: Pattern matching on values
  if (!email || !phone) {
    for (const value of Object.values(requestData)) {
      if (!value || typeof value !== 'string') continue;

      if (!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        email = value;
      }
      if (!phone && /^[\+]?[0-9\s\-()]{9,15}$/.test(value.trim())) {
        phone = value.trim();
      }
    }
  }

  return { email, phone };
};

/**
 * Send status-change notifications (email + WhatsApp) for a request.
 * This is fire-and-forget — errors are logged but never thrown.
 *
 * @param {object} params
 * @param {number} params.requestId - The request ID
 * @param {object} params.requestData - The JSONB `data` object
 * @param {string} params.typeName - User type name
 * @param {string} params.status - 'approved' | 'rejected'
 * @param {string} [params.adminNotes] - Optional admin notes
 * @param {Array}  [params.fields] - Optional FieldsMaster field definitions
 */
const notifyRequestStatusChange = async ({
  requestId,
  requestData,
  typeName,
  status,
  adminNotes,
  fields = [],
}) => {
  try {
    const { email, phone } = extractContactInfo(requestData, fields);

    logger.info('Sending status notifications', {
      action: 'notification_start',
      requestId,
      status,
      hasEmail: !!email,
      hasPhone: !!phone,
    });

    const results = { email: null, whatsapp: null };

    // Build & send in parallel
    const promises = [];

    if (email) {
      const subject = `تحديث حالة الطلب #${requestId} — ${status === 'approved' ? 'مقبول' : 'مرفوض'}`;
      const html = buildStatusEmail(requestId, typeName, status, adminNotes);
      promises.push(
        sendEmail(email, subject, html).then((r) => { results.email = r; })
      );
    } else {
      logger.info('Email notification skipped — no email found in request data', {
        action: 'notification_skip_email',
        requestId,
      });
    }

    if (phone) {
      const message = buildStatusWhatsApp(requestId, typeName, status, adminNotes);
      promises.push(
        sendWhatsApp(phone, message).then((r) => { results.whatsapp = r; })
      );
    } else {
      logger.info('WhatsApp notification skipped — no phone found in request data', {
        action: 'notification_skip_whatsapp',
        requestId,
      });
    }

    await Promise.allSettled(promises);

    logger.info('Status notifications completed', {
      action: 'notification_complete',
      requestId,
      emailSent: results.email?.success || false,
      whatsappSent: results.whatsapp?.success || false,
    });

    return results;
  } catch (error) {
    // This should never happen, but we catch everything to ensure
    // notification failures never break the main request flow.
    logger.error('Unexpected error in notification service', {
      action: 'notification_error',
      requestId,
      error: error.message,
    });
    return { email: null, whatsapp: null };
  }
};

module.exports = { notifyRequestStatusChange, extractContactInfo };
