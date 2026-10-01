import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import pool from './db';

let schemaPromise;
export function ensureEmailVerificationSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        purpose VARCHAR(20) NOT NULL DEFAULT 'register',
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `).then(async () => {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_active
        ON email_verifications (LOWER(email), purpose) WHERE consumed_at IS NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verifications_expires
        ON email_verifications (expires_at)`);
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true');
    }).catch((error) => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

export async function saveEmailCode(email, purpose) {
  await ensureEmailVerificationSchema();
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const result = await pool.query(`
    INSERT INTO email_verifications (email, code_hash, purpose, expires_at)
    VALUES ($1, $2, $3, now() + interval '10 minutes')
    ON CONFLICT (LOWER(email), purpose) WHERE consumed_at IS NULL
    DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
      attempts = 0, created_at = now()
    WHERE email_verifications.created_at < now() - interval '60 seconds'
    RETURNING id
  `, [email, hashCode(code), purpose]);
  return result.rowCount ? code : null;
}

export async function invalidateEmailCode(email, purpose) {
  await pool.query(`UPDATE email_verifications SET consumed_at = now()
    WHERE LOWER(email) = $1 AND purpose = $2 AND consumed_at IS NULL`, [email, purpose]);
}

export const CODE_ERRORS = {
  missing: '请先获取验证码',
  expired: '验证码已过期，请重新获取',
  too_many: '尝试次数过多，请重新获取验证码',
  mismatch: '验证码错误',
};

// 验证码和最终账号修改在同一事务中提交，失败时验证码不会被消费。
export async function withEmailCode(email, purpose, code, action) {
  await ensureEmailVerificationSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      SELECT id, code_hash, attempts, expires_at FROM email_verifications
      WHERE LOWER(email) = $1 AND purpose = $2 AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE
    `, [email, purpose]);
    const row = result.rows[0];
    let failure = null;
    if (!row) failure = 'missing';
    else if (new Date(row.expires_at).getTime() <= Date.now()) failure = 'expired';
    else if (row.attempts >= 5) failure = 'too_many';
    else {
      const provided = Buffer.from(hashCode(String(code)));
      const expected = Buffer.from(row.code_hash);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) failure = 'mismatch';
    }
    if (failure) {
      if (row && failure === 'mismatch') {
        await client.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      }
      await client.query('COMMIT');
      return { failure };
    }
    const value = await action(client);
    await client.query('UPDATE email_verifications SET consumed_at = now() WHERE id = $1', [row.id]);
    await client.query('COMMIT');
    return { value };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function isEmailVerificationRequired() {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'email_verify_required'");
  return result.rows[0]?.value === 'true';
}
