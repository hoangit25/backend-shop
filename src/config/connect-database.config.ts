import mongoose from 'mongoose';
import { env } from './env.config';

export const connectDb = async (retries = 2, delay = 1000): Promise<void> => {
  let attempt = 0;

  while (attempt < retries) {
    try {
      await mongoose.connect(env.MONGO_URL);
      console.log('✅ Connected to MongoDB successfully.');
      return;
    } catch (error) {
      attempt++;
      console.error(
        `❌ MongoDB connection attempt ${attempt}/${retries} failed:`,
        error
      );

      if (attempt >= retries) {
        console.error(
          '💥 Exceeded maximum MongoDB connection retries. Exiting process.'
        );
        process.exit(1);
      }

      console.log(`⏳ Retrying MongoDB connection in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const connect = connectDb;

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB connection lost.');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB connection re-established.');
});
