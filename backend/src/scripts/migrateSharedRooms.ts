import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { ProductModel } from '../models/Product.js';
import { hasLegacyRooms, liftLegacyProductRooms } from '../utils/roomPreview.js';

const apply = process.argv.includes('--apply');

async function run() {
  await connectDb();
  const products = await ProductModel.collection.find({ 'variants.roomPreviews.0': { $exists: true } }).toArray();
  let migrated = 0;
  let legacyRooms = 0;
  let sharedRooms = 0;

  for (const product of products) {
    if (!hasLegacyRooms(product)) continue;
    const legacyCount = (product.variants ?? []).reduce((total: number, variant: { roomPreviews?: unknown[] }) => total + (variant.roomPreviews?.length ?? 0), 0);
    const result = liftLegacyProductRooms(product);
    migrated += 1;
    legacyRooms += legacyCount;
    sharedRooms += result.roomPreviews.length;
    console.log(`${apply ? 'Migrating' : 'Would migrate'} ${product._id}: ${legacyCount} legacy rooms -> ${result.roomPreviews.length} shared rooms`);
    if (apply) {
      await ProductModel.collection.updateOne(
        { _id: product._id },
        { $set: { roomPreviews: result.roomPreviews, variants: result.variants } },
      );
    }
  }

  console.log(`${apply ? 'Migrated' : 'Dry run'}: ${migrated} products, ${legacyRooms} legacy rooms, ${sharedRooms} shared rooms.`);
  if (!apply) console.log('Run with --apply to persist these changes.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
