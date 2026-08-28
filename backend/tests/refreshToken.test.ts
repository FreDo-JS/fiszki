import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { signRefreshToken } from '../src/utils/jwt';
import { TEST_ORIGIN } from './helpers';

const app = createApp();

describe('refresh token issuance', () => {
  it('mints a unique token even when two are signed in the same second', () => {
    const a = signRefreshToken({ sub: 'same-user-id' });
    const b = signRefreshToken({ sub: 'same-user-id' });
    expect(a).not.toBe(b);
  });

  it('allows the same user to log in repeatedly in quick succession', async () => {
    const user = {
      username: 'rapid',
      email: 'rapid@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    };
    await request(app).post('/api/auth/register').set('Origin', TEST_ORIGIN).send(user);

    // Back-to-back logins land within the same second and previously
    // collided on RefreshToken.tokenHash, surfacing as a 409.
    const results = await Promise.all(
      Array.from({ length: 3 }).map(() =>
        request(app)
          .post('/api/auth/login')
          .set('Origin', TEST_ORIGIN)
          .send({ email: user.email, password: user.password })
      )
    );

    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });
});
