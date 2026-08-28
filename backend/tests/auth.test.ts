import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { TEST_ORIGIN } from './helpers';

const app = createApp();

const validUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
};

describe('POST /api/auth/register', () => {
  it('creates a new user and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validUser.email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('rejects mismatched passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({ ...validUser, confirmPassword: 'Different1' });
    expect(res.status).toBe(400);
  });

  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({ ...validUser, password: 'weak', confirmPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send(validUser);
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({ ...validUser, username: 'anotheruser' });
    expect(res.status).toBe(409);
  });

  it('silently ignores a client-supplied role, never granting ADMIN via mass assignment', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_ORIGIN)
      .send({ ...validUser, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');
  });

  it('rejects requests from an origin outside the CORS whitelist', async () => {
    const res = await request(app).post('/api/auth/register').set('Origin', 'https://evil.example').send(validUser);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets httpOnly cookies', async () => {
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send(validUser);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=') && c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects an incorrect password with a generic message', async () => {
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send(validUser);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: validUser.email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });

  it('gives the same error for a non-existent account, preventing email enumeration', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'nobody@example.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/e-mail lub hasło/i);
  });
});

describe('GET /api/auth/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for an authenticated session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').set('Origin', TEST_ORIGIN).send(validUser);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(validUser.username);
  });
});
