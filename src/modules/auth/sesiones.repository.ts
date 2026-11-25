import crypto from 'node:crypto';
import { db } from '../../config/database';
import { env } from '../../config/env';

export interface SessionRow {
  id: number;
  usuario_id: number;
  refresh_token_hash: string;
  creada_en: string;
  expira_en: string;
  revocada_en: string | null;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(usuarioId: number): { token: string; expiraEn: string } {
  const token = crypto.randomBytes(48).toString('hex');
  const expiraEn = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  db.prepare('INSERT INTO sesiones (usuario_id, refresh_token_hash, expira_en) VALUES (?, ?, ?)').run(
    usuarioId,
    hashToken(token),
    expiraEn,
  );

  return { token, expiraEn };
}

export function findActiveSession(token: string): SessionRow | undefined {
  return db
    .prepare(
      `SELECT id, usuario_id, refresh_token_hash, creada_en, expira_en, revocada_en
       FROM sesiones
       WHERE refresh_token_hash = ? AND revocada_en IS NULL AND expira_en > datetime('now')`,
    )
    .get(hashToken(token)) as SessionRow | undefined;
}

export function revokeSession(id: number): void {
  db.prepare(`UPDATE sesiones SET revocada_en = datetime('now') WHERE id = ? AND revocada_en IS NULL`).run(id);
}

export function revokeAllSessions(usuarioId: number): void {
  db.prepare(
    `UPDATE sesiones SET revocada_en = datetime('now') WHERE usuario_id = ? AND revocada_en IS NULL`,
  ).run(usuarioId);
}
