import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../../src/app.js';

const previousSecret = process.env.JWT_SECRET;
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  process.env.JWT_SECRET = 'offline-test-secret';
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health does not need database access', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test('protected route rejects missing and invalid bearer tokens', async () => {
  const route = `${baseUrl}/api/auth/me`;
  assert.equal((await fetch(route)).status, 401);
  assert.equal((await fetch(route, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
});
