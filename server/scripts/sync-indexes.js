/**
 * One-off: build/refresh every collection's indexes from the Mongoose schemas (guide §12.4).
 * Run once against a new database (e.g. Azure Cosmos DB for MongoDB vCore) instead of on every boot:
 *   npm --prefix server run sync-indexes
 * syncIndexes() also drops indexes that are no longer in a schema, so it prints what it changed.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import * as models from '../src/models/index.js';

await connectDB();
console.log(`Syncing indexes on "${mongoose.connection.name}"...`);
for (const [name, Model] of Object.entries(models)) {
  if (typeof Model?.syncIndexes !== 'function') continue;
  const dropped = await Model.syncIndexes();
  const current = await Model.listIndexes();
  console.log(`  ${name.padEnd(24)} ${current.length} indexes${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`);
}
await mongoose.disconnect();
console.log('Done.');
