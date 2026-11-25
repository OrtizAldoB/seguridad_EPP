import fs from 'node:fs';
import path from 'node:path';

const base = path.resolve(process.cwd(), 'database/test_epp.sqlite');
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(`${base}${suffix}`, { force: true });
}
