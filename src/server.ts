import 'dotenv/config';
import { app } from './app.js';
import { getPostgresPool } from './config/postgres.js';

const port = Number(process.env.PORT ?? 5000);

async function bootstrap() {
  await getPostgresPool().query('SELECT 1');
  app.listen(port, () => console.log(`Product Config API listening on http://localhost:${port}`));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
