import crypto from 'crypto';

const base64UrlEncode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const sign = (data) =>
  crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_SECRET || 'road-sentry-dev-secret')
    .update(data)
    .digest('base64url');

export const createAdminToken = (admin) => {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlEncode({
    sub: admin._id.toString(),
    username: admin.username,
    role: admin.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  });
  const signature = sign(`${header}.${payload}`);

  return `${header}.${payload}.${signature}`;
};

export const verifyAdminToken = (token) => {
  const parts = token?.split('.');
  if (parts?.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = sign(`${header}.${payload}`);
  if (signature.length !== expectedSignature.length) return null;

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValidSignature) return null;

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.exp || data.exp * 1000 <= Date.now()) return null;

  return data;
};
