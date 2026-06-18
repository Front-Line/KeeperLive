'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn(
      '[mailer] SMTP_USER / SMTP_PASS not configured — email alerts are disabled.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT) || 465,
    secure: String(SMTP_SECURE ?? 'true') === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/**
 * Send an email to a list of recipients.
 * @param {string[]} to
 * @param {string} subject
 * @param {string} text
 */
async function sendMail(to, subject, text) {
  const tx = getTransporter();
  if (!tx) return false;
  if (!to || to.length === 0) {
    console.warn('[mailer] No recipients configured — skipping email.');
    return false;
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await tx.sendMail({ from, to: to.join(', '), subject, text });
  return true;
}

module.exports = { sendMail };
