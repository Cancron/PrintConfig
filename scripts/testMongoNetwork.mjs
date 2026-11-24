import 'dotenv/config';
import { lookup, resolveSrv } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

const timeoutMs = 5000;
const logFile = path.resolve('logs', `mongo-network-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

async function log(message, details) {
  const line = `[${new Date().toISOString()}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}`;
  console.log(line);
  await appendFile(logFile, `${line}\n`, 'utf8');
}

function probe(host, port, address, secure) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = secure
      ? tls.connect({ host: address, port, servername: host, rejectUnauthorized: true })
      : net.createConnection({ host: address, port });
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({ ...result, elapsedMs: Date.now() - started });
    };
    socket.setTimeout(timeoutMs, () => finish({ ok: false, code: 'TIMEOUT' }));
    socket.once('error', (error) => finish({ ok: false, code: error.code, message: error.message }));
    socket.once(secure ? 'secureConnect' : 'connect', () => finish({ ok: true, protocol: secure ? socket.getProtocol() : 'TCP' }));
  });
}

try {
  await mkdir(path.dirname(logFile), { recursive: true });
  await log('Atlas network test started.', { node: process.version, timeoutMs });
  const uri = process.env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Invalid MongoDB URI.');
  let servers;
  if (uri.startsWith('mongodb+srv://')) {
    const hostname = new URL(uri).hostname;
    servers = await resolveSrv(`_mongodb._tcp.${hostname}`);
    await log('SRV DNS resolved.', { hostname, serverCount: servers.length });
  } else {
    const authority = uri.slice('mongodb://'.length).split(/[/?]/)[0];
    const hosts = authority.slice(authority.lastIndexOf('@') + 1);
    servers = hosts.split(',').map((host) => {
      const parsed = new URL(`http://${host}`);
      return { name: parsed.hostname.replace(/^\[|\]$/g, ''), port: Number(parsed.port || 27017) };
    });
    await log('Using hosts from standard MongoDB URI.', { serverCount: servers.length });
  }
  if (!servers.length) throw new Error('DNS returned no MongoDB servers.');
  for (const server of servers) {
    try {
      const addresses = await lookup(server.name, { all: true });
      await log('Server DNS resolved.', { host: server.name, port: server.port, addresses });
      if (!addresses.length) throw new Error('No IP addresses resolved.');
      for (const { address, family } of addresses) {
        const tcp = await probe(server.name, server.port, address, false);
        await log('TCP result.', { host: server.name, port: server.port, address, family, ...tcp });
        if (!tcp.ok) { process.exitCode = 1; continue; }
        const handshake = await probe(server.name, server.port, address, true);
        await log('TLS result.', { host: server.name, port: server.port, address, ...handshake });
        if (!handshake.ok) process.exitCode = 1;
      }
    } catch (error) {
      process.exitCode = 1;
      await log('Server test failed.', { host: server.name, code: error.code, message: error.message });
    }
  }
  await log('Test finished. TCP/TLS success confirms network access; run test:mongo to check credentials and database access.');
} catch (error) {
  process.exitCode = 1;
  await log('Network test failed.', { code: error.code, message: error.code ? error.message : 'Check MONGODB_URI format and configuration.' });
} finally {
  console.log(`Log file: ${logFile}`);
}
