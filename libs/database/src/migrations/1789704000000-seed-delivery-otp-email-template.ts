import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DATABASE_TABLE as T } from '../../../contracts/src/index.js';

/**
 * Seeds the DELIVERY_OTP email template.
 *
 * Variables used inside the template:
 *   {{name}}        – customer's display name
 *   {{otp}}         – 6-digit OTP
 *   {{orderNumber}} – order reference number
 *   {{appName}}     – injected automatically by EmailNotificationService
 *   {{currentYear}} – injected automatically by EmailNotificationService
 */
export class SeedDeliveryOtpEmailTemplate1789704000000
  implements MigrationInterface
{
  name = 'SeedDeliveryOtpEmailTemplate1789704000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const subjectTemplate = `Your delivery OTP for order {{orderNumber}} – {{appName}}`;

    const textBody = `Hi {{name}},

Your delivery partner has arrived! Please share the following OTP to complete your delivery:

  OTP: {{otp}}

This OTP is valid for 2 hours. Do NOT share it before you receive your order.

Thank you for ordering with {{appName}}!

— The {{appName}} Team
© {{currentYear}} {{appName}}`;

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Delivery OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                🛵 Delivery OTP
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">
                Hi <strong>{{name}}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Your delivery partner has arrived at your location for order
                <strong style="color:#111827;">{{orderNumber}}</strong>.
                Share the OTP below <strong>only after you receive your order</strong>:
              </p>
              <!-- OTP box -->
              <div style="background:#fff7ed;border:2px dashed #ff6b35;border-radius:10px;padding:28px;text-align:center;margin:0 0 28px;">
                <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;font-weight:600;">
                  One-Time Password
                </p>
                <p style="margin:0;font-size:48px;font-weight:800;letter-spacing:12px;color:#ff6b35;font-family:'Courier New',monospace;">
                  {{otp}}
                </p>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-align:center;">
                ⏰ This OTP is valid for <strong>2 hours</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#ef4444;text-align:center;font-weight:600;">
                🔒 Never share this OTP before receiving your order.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © {{currentYear}} {{appName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const requiredVariables = JSON.stringify(['name', 'otp', 'orderNumber']);

    await queryRunner.query(`
      INSERT INTO \`${T.EMAIL_TEMPLATES}\`
        (template_key, locale, subject_template, html_body, text_body, required_variables, is_active, version)
      VALUES
        ('DELIVERY_OTP', 'en', ?, ?, ?, ?, 1, 1)
      ON DUPLICATE KEY UPDATE
        subject_template = VALUES(subject_template),
        html_body        = VALUES(html_body),
        text_body        = VALUES(text_body),
        required_variables = VALUES(required_variables),
        is_active        = 1
    `, [subjectTemplate, htmlBody, textBody, requiredVariables]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`${T.EMAIL_TEMPLATES}\` WHERE template_key = 'DELIVERY_OTP' AND locale = 'en'`,
    );
  }
}
