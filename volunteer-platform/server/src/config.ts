import path from 'node:path';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}，请参考 .env.example`);
  return value;
}

export function config() {
  const secret = required('JWT_SECRET');
  if (secret.length < 32 || secret.startsWith('replace-with')) throw new Error('JWT_SECRET 需为至少 32 位随机字符串');
  const demo = process.env.DEMO_MODE === 'true';
  const provider = process.env.SMS_PROVIDER || 'mock';
  if (!['mock', 'tencent'].includes(provider)) throw new Error('未知短信服务商');
  if (demo && provider !== 'mock') throw new Error('演示环境仅允许模拟短信');
  return {
    databaseUrl: required('DATABASE_URL'), secret, demo, provider,
    port: Number(process.env.PORT || 6101),
    origin: process.env.ADMIN_ORIGIN || 'http://localhost:6102',
    exportDirectory: path.resolve(process.env.EXPORT_DIRECTORY || './data/exports'),
    notificationsEnabled: process.env.SMS_NOTIFICATIONS_ENABLED !== 'false',
  };
}
