-- Plate40 transactional email templates for MySQL 8+.
-- Run after: npm run migration:run
-- Re-running this script updates version 1 instead of creating duplicates.

START TRANSACTION;

INSERT INTO `email_templates`
  (`template_key`, `locale`, `subject_template`, `html_body`, `text_body`, `required_variables`, `provider_template_id`, `is_active`, `version`)
VALUES
(
  'WELCOME', 'en', 'Welcome to {{appName}}, {{name}}',
  '<!doctype html><html><body style="margin:0;background:#fff7ed;font-family:Arial,sans-serif;color:#292524"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #fed7aa;border-radius:18px;overflow:hidden"><tr><td style="background:#f97316;padding:28px 32px;color:#fff;font-size:26px;font-weight:800">{{appName}}</td></tr><tr><td style="padding:34px 32px"><h1>Welcome, {{name}}!</h1><p>Your account is ready. Discover restaurants and order your favourite food.</p><p><a href="{{loginLink}}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;text-decoration:none;border-radius:9px;font-weight:700">Sign in</a></p></td></tr><tr><td style="background:#fffaf5;padding:20px 32px;font-size:12px;color:#78716c">Transactional email from {{appName}} · © {{currentYear}}</td></tr></table></td></tr></table></body></html>',
  'Welcome, {{name}}! Your {{appName}} account is ready. Sign in: {{loginLink}}',
  JSON_ARRAY('name', 'loginLink'), NULL, 1, 1
),
(
  'EMAIL_VERIFICATION', 'en', 'Verify your {{appName}} email',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><h1>Verify your email</h1><p>Hello {{name}}, use this code to verify your email address:</p><p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#ea580c">{{otp}}</p><p>This code expires in {{expiresInMinutes}} minutes.</p><p>If you did not request it, you can ignore this email.</p></div></body></html>',
  'Hello {{name}}, your {{appName}} email verification code is {{otp}}. It expires in {{expiresInMinutes}} minutes.',
  JSON_ARRAY('name', 'otp', 'expiresInMinutes'), NULL, 1, 1
),
(
  'PASSWORD_RESET', 'en', 'Reset your {{appName}} password',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><h1>Password reset</h1><p>Hello {{name}}, use the button below to reset your password.</p><p><a href="{{resetLink}}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;text-decoration:none;border-radius:9px;font-weight:700">Reset password</a></p><p>This link expires in {{expiresInMinutes}} minutes. If you did not request this, ignore this email.</p></div></body></html>',
  'Hello {{name}}, reset your {{appName}} password here: {{resetLink}}. This link expires in {{expiresInMinutes}} minutes.',
  JSON_ARRAY('name', 'resetLink', 'expiresInMinutes'), NULL, 1, 1
),
(
  'ORDER_CREATED', 'en', 'Order {{orderNumber}} confirmed',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><div style="color:#166534;font-weight:700">ORDER CONFIRMED</div><h1>Thanks, {{name}}!</h1><p>Your order <strong>{{orderNumber}}</strong> from <strong>{{restaurantName}}</strong> has been placed.</p><table width="100%" style="background:#fff7ed;padding:16px;border-radius:12px"><tr><td>Total</td><td align="right"><strong>{{orderTotal}}</strong></td></tr><tr><td>Delivery address</td><td align="right"><strong>{{deliveryAddress}}</strong></td></tr></table><p><a href="{{orderLink}}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;text-decoration:none;border-radius:9px;font-weight:700">Track order</a></p></div></body></html>',
  'Order {{orderNumber}} from {{restaurantName}} is confirmed. Total: {{orderTotal}}. Delivery: {{deliveryAddress}}. Track: {{orderLink}}',
  JSON_ARRAY('name', 'orderNumber', 'restaurantName', 'orderTotal', 'deliveryAddress', 'orderLink'), NULL, 1, 1
),
(
  'ORDER_STATUS_CHANGED', 'en', 'Order {{orderNumber}} is now {{orderStatus}}',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><h1>Order update</h1><p>Hello {{name}}, order <strong>{{orderNumber}}</strong> is now <strong>{{orderStatus}}</strong>.</p><p>{{statusMessage}}</p><p><a href="{{orderLink}}" style="color:#ea580c;font-weight:700">View order details</a></p></div></body></html>',
  'Hello {{name}}, order {{orderNumber}} is now {{orderStatus}}. {{statusMessage}} View: {{orderLink}}',
  JSON_ARRAY('name', 'orderNumber', 'orderStatus', 'statusMessage', 'orderLink'), NULL, 1, 1
),
(
  'PAYMENT_SUCCESS', 'en', 'Payment received for order {{orderNumber}}',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><div style="color:#166534;font-weight:700">PAYMENT SUCCESSFUL</div><h1>Payment received</h1><p>We received <strong>{{amount}}</strong> for order <strong>{{orderNumber}}</strong>.</p><p>Payment reference: {{paymentReference}}</p><p><a href="{{orderLink}}" style="color:#ea580c;font-weight:700">View order</a></p></div></body></html>',
  'Payment of {{amount}} for order {{orderNumber}} was successful. Reference: {{paymentReference}}. View: {{orderLink}}',
  JSON_ARRAY('amount', 'orderNumber', 'paymentReference', 'orderLink'), NULL, 1, 1
),
(
  'PAYMENT_FAILED', 'en', 'Payment failed for order {{orderNumber}}',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><div style="color:#991b1b;font-weight:700">PAYMENT FAILED</div><h1>We could not complete your payment</h1><p>The payment of <strong>{{amount}}</strong> for order <strong>{{orderNumber}}</strong> was unsuccessful.</p><p><a href="{{retryLink}}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;text-decoration:none;border-radius:9px;font-weight:700">Try payment again</a></p></div></body></html>',
  'Payment of {{amount}} for order {{orderNumber}} failed. Try again: {{retryLink}}',
  JSON_ARRAY('amount', 'orderNumber', 'retryLink'), NULL, 1, 1
),
(
  'RESTAURANT_APPROVED', 'en', '{{restaurantName}} has been approved on {{appName}}',
  '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#292524;background:#fff7ed;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:18px"><div style="color:#166534;font-weight:700">RESTAURANT APPROVED</div><h1>You are ready to serve!</h1><p>Hello {{merchantName}}, <strong>{{restaurantName}}</strong> has been approved.</p><p><a href="{{dashboardLink}}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 20px;text-decoration:none;border-radius:9px;font-weight:700">Open dashboard</a></p></div></body></html>',
  'Hello {{merchantName}}, {{restaurantName}} has been approved on {{appName}}. Dashboard: {{dashboardLink}}',
  JSON_ARRAY('merchantName', 'restaurantName', 'dashboardLink'), NULL, 1, 1
)
ON DUPLICATE KEY UPDATE
  `subject_template` = VALUES(`subject_template`),
  `html_body` = VALUES(`html_body`),
  `text_body` = VALUES(`text_body`),
  `required_variables` = VALUES(`required_variables`),
  `provider_template_id` = VALUES(`provider_template_id`),
  `is_active` = VALUES(`is_active`),
  `updated_at` = CURRENT_TIMESTAMP(6);

COMMIT;
