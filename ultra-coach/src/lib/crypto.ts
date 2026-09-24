import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Chiffrement AES-256-GCM des secrets stockés en base (tokens OAuth).
 * Clé : TOKEN_ENC_KEY (n'importe quelle chaîne longue et aléatoire ; dérivée en 32 octets).
 * Format : base64(iv[12] | tag[16] | ciphertext)
 */
function key(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw || raw.length < 32) throw new Error("TOKEN_ENC_KEY manquante ou trop courte (32 caractères minimum).");
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
