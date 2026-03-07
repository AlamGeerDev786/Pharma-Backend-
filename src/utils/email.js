import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, html }) {
  return transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export function passwordResetEmail(resetUrl, userName) {
  return {
    subject: 'Reset Your Password - PharmaCare',
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#333;">
        <div style="background:#2563EB;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:24px;">PharmaCare</h1>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <h2 style="margin:0 0 16px;font-size:20px;">Password Reset Request</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:#2563EB;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;display:inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color:#6b7280;font-size:14px;">This link will expire in <strong>3 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;margin:0;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color:#2563EB;font-size:12px;word-break:break-all;">${resetUrl}</p>
        </div>
      </div>
    `,
  };
}
