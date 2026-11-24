import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

const startedAt = Date.now();
const logFile = path.resolve('logs', `mongo-connection-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const secrets = [process.env.DB_PASSWORD, process.env.DB_USER, process.env.MONGODB_URI].filter(Boolean);
const connection = mongoose.createConnection();

function redact(value) {
  let text = String(value);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[REDACTED_MONGODB_URI]');
}

async function log(message, details) {
  const line = redact(`[${new Date().toISOString()}] ${message}${details === undefined ? '' : ` ${JSON.stringify(details)}`}`);
  console.log(line);
  await appendFile(logFile, `${line}\n`, 'utf8');
}

function errorDetails(error, depth = 0) {
  if (!error || depth > 3) return undefined;
  return {
    name: error.name,
    message: error.message ?? String(error),
    code: error.code,
    cause: error.cause ? errorDetails(error.cause, depth + 1) : undefined,
  };
}

try {
  await mkdir(path.dirname(logFile), { recursive: true });
  await log('MongoDB connection test started.', {
    node: process.version,
    mongoose: mongoose.version,
    cwd: process.cwd(),
    uriConfigured: Boolean(process.env.MONGODB_URI),
    databaseConfigured: Boolean(process.env.DB_NAME),
    userConfigured: Boolean(process.env.DB_USER),
    passwordConfigured: Boolean(process.env.DB_PASSWORD),
    timeoutMs: 15000,
  });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Run from backend with its .env configured.');

  await connection.openUri(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 15000,
  });
  await connection.db.command({ ping: 1 });
  await log('SUCCESS: MongoDB connected and ping succeeded.', { elapsedMs: Date.now() - startedAt });
} catch (error) {
  process.exitCode = 1;
  await log('FAILED: MongoDB connection test.', { elapsedMs: Date.now() - startedAt, error: errorDetails(error) });
  const topology = error.reason ?? error.cause;
  if (topology?.servers instanceof Map) {
    await log('Cluster topology.', { type: topology.type });
    for (const [address, server] of topology.servers) {
      await log('Server connection details.', { address, type: server.type, error: errorDetails(server.error) });
    }
  }
} finally {
  await connection.close().catch(() => {});
  console.log(`Log file: ${logFile}`);
}
