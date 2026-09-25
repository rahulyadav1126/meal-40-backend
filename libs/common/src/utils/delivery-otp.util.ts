import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Domain-separated key; configure a dedicated DELIVERY_OTP_SECRET for independent rotation.
const key = (secret: string) => createHash('sha256').update(`plate40:delivery-otp:v1:${secret}`).digest();
export function sealDeliveryOtp(otp: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(otp, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function openDeliveryOtp(value: string, secret: string): string {
  const [iv, tag, encrypted] = value.split('.').map(v => Buffer.from(v, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
}
