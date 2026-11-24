import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app.js';
import { UserModel } from '../../src/models/User.js';

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
  mock.restoreAll();
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

test('sign-in rejects invalid credentials and returns a token for valid credentials', async () => {
  const passwordHash = bcrypt.hashSync('correct-password', 4);
  const findOne = mock.method(UserModel, 'findOne', () => ({ select: async () => ({
    _id: '507f1f77bcf86cd799439011', email: 'admin@example.test', name: 'Admin',
    role: 'admin', isActive: true, passwordHash,
  }) }));
  const signIn = (password: string) => fetch(`${baseUrl}/api/auth/signin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ADMIN@example.test', password }),
  });

  try {
    const invalid = await signIn('wrong-password');
    assert.equal(invalid.status, 401);
    const valid = await signIn('correct-password');
    assert.equal(valid.status, 200);
    const body = await valid.json();
    assert.equal(body.user.email, 'admin@example.test');
    assert.equal(typeof body.token, 'string');
    assert.equal(findOne.mock.callCount(), 2);
    assert.equal(findOne.mock.calls[0].arguments[0].email, 'admin@example.test');
  } finally {
    findOne.mock.restore();
  }
});
