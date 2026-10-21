import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { sweepExpiredTrust } from './services/trust.service.js';

async function start() {
  try {
    await connectDB();
    console.log(`MongoDB connected (${mongoose.connection.name})`);
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  const server = createApp().listen(env.port, () => {
    console.log(`UNIO API listening on http://localhost:${env.port}/api`);
  });

  // Approvals last 12 months: drop lapsed ones from profiles and Discover without waiting for a read.
  const sweep = () => sweepExpiredTrust().catch((err) => console.error('[trust] expiry sweep failed:', err.message));
  sweep();
  setInterval(sweep, 60 * 60 * 1000).unref();

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
