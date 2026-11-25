import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      PORT: '3100',
      DB_PATH: 'database/test_epp.sqlite',
      JWT_ACCESS_SECRET: 'test-access-secret-suficientemente-largo-2026',
      JWT_REFRESH_SECRET: 'test-refresh-secret-suficientemente-largo-2026',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: '7',
      BCRYPT_ROUNDS: '4',
      SEED_PASSWORD: 'Clave123!',
    },
  },
});
