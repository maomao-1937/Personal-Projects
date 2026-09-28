import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

function encryptionKey(secret) {
  return createHmac('sha256', secret).update('legacy-draft-metadata-encryption-v1').digest();
}

function validMetadata(value) {
  return value && typeof value === 'object' && /^[a-f0-9]{32}$/.test(value.salt) && /^[a-f0-9]{64}$/.test(value.hash);
}

export function encryptLegacyDraftMetadata(secret, value) {
  if (!validMetadata(value)) throw new Error('旧草稿映射数据无效');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('hex'), ciphertext: ciphertext.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

export function decryptLegacyDraftMetadata(secret, value) {
  if (!value?.iv && !value?.ciphertext && !value?.tag) return null;
  if (!value?.iv || !value?.ciphertext || !value?.tag) throw new Error('旧草稿映射密文不完整');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(value.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(value.tag, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'hex')), decipher.final()]).toString('utf8');
  const metadata = JSON.parse(plaintext);
  if (!validMetadata(metadata)) throw new Error('旧草稿映射数据无效');
  return metadata;
}
