/**
 * Runs the API against a throwaway in-memory MongoDB (replica set, so transactions work),
 * seeded with demo data. Useful offline or before Atlas network access is configured.
 *   npm run dev:memory
 * Data is lost when the process stops.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const root = fileURLToPath(new URL('..', import.meta.url));
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const uri = replSet.getUri('invitaizen');
const env = {
  ...process.env,
  MONGODB_URI: uri,
  SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD || 'UnioDemo2026!',
};

console.log(`In-memory MongoDB ready at ${uri}`);

const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited with ${code}`))));
  });

await run(['scripts/seed.js']);
const server = spawn(process.execPath, ['src/server.js'], { cwd: root, env, stdio: 'inherit' });

const stop = async () => {
  server.kill();
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
