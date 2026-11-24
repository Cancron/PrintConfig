import mongoose from 'mongoose';

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
      dbName: process.env.DB_NAME,
      user: process.env.DB_USER,
      pass: process.env.DB_PASSWORD
  });
  return mongoose.connection;
}
