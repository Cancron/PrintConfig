import 'dotenv/config';
import { app } from './app.js';
import { connectDb } from './config/db.js';

const port = Number(process.env.PORT ?? 5000);

async function bootstrap() {
  await connectDb();
  app.listen(port, () => console.log(`Product Config API listening on http://localhost:${port}`));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
