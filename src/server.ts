import app from './app';
import { connectDb } from './config/connect-database.config';
import { env } from './config/env.config';
import mongoose from 'mongoose';

async function bootstrap() {
  await connectDb();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      console.log('🔒 HTTP server closed.');
      try {
        await mongoose.connection.close();
        console.log('🔒 MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error('💥 Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: any) => {
    console.error('💥 Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap();
