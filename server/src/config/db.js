import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri = env.mongoUri) {
  if (!uri) throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env.');

  if (env.dnsServers.length) dns.setServers(env.dnsServers);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  } catch (err) {
    // Node's resolver sometimes refuses SRV queries on Windows; retry once with public DNS.
    if (uri.startsWith('mongodb+srv://') && /querySrv|ENOTFOUND|ECONNREFUSED/.test(err.message)) {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    } else {
      throw err;
    }
  }
  return mongoose.connection;
}

export function dbState() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ?? 'unknown';
}
