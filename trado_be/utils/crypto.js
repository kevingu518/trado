import crypto from 'crypto';
import { AppError } from '../errors/index.js';

// AES-256-GCM 對稱加密，用於儲存使用者的 AI API key。
// master secret 放在環境變數 ENCRYPTION_KEY（任意長度字串，會被 sha256 推導成 32 bytes 金鑰）。
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 建議 12 bytes

function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new AppError('ENCRYPTION_KEY 尚未設定，無法加密 AI API key', 500);
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * 加密純文字，回傳 "iv:authTag:cipher"（皆為 base64）
 */
export function encrypt(plainText) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * 解密 "iv:authTag:cipher" 格式字串，回傳原始純文字
 */
export function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new AppError('AI API key 解密失敗：格式錯誤', 500);
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
