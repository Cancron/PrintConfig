import 'dotenv/config';
import { app } from './app.js';
import { connectDb } from './config/db.js';
import { ensureDemoAccount, seedMerchants } from './services/merchant.service.js';
import { seedCanvasCategory } from './services/category.service.js';
import { seedProducts } from './services/product.service.js';

const port = Number(process.env.PORT ?? 5000);

async function bootstrap() {
  await connectDb();
  const account = await ensureDemoAccount();
  await seedMerchants(account.id);
  const category = await seedCanvasCategory(account.id);
  await seedProducts(account.id, category.id);
  app.listen(port, () => console.log(`Product Config API listening on http://localhost:${port}`));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
