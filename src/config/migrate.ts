import { db } from './database';
import { bootstrap } from './bootstrap';

try {
  bootstrap();
  console.log('[migrate] base de datos lista');
} finally {
  db.close();
}
