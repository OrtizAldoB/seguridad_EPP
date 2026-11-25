import { migrate } from './database';
import { seed } from './seed';

export function bootstrap(): void {
  migrate();
  seed();
}
