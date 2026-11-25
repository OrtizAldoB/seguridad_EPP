import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DB_PATH: z.string().min(1).default('database/epp_sistema.sqlite'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(16).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_EMAIL: z.string().email().default('admin@epp.com'),
  SEED_PASSWORD: z.string().min(8).default('Clave123!'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
