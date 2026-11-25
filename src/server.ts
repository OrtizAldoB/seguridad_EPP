import app from './app';
import { bootstrap } from './config/bootstrap';
import { env } from './config/env';

bootstrap();

const server = app.listen(env.PORT, () => {
  console.log(`[server] API lista en http://localhost:${env.PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
