import { makeJwt, secondsFromNow } from '../testing/jwt-fixtures';
import { buildSession, isExpired } from './session';

const entraToken = makeJwt({
  aud: 'api-client-id',
  scp: 'orders.read orders.write events.read',
  roles: ['admin'],
  tid: 'tenant-1',
  name: 'Nombre del token',
  exp: secondsFromNow(3600),
});

describe('buildSession', () => {
  it('combines the MSAL account with the claims of the access token', () => {
    const session = buildSession(entraToken, { name: 'Ana Pérez', username: 'ana@jdv.onmicrosoft.com', tenantId: 'tenant-9' });
    expect(session).toMatchObject({
      name: 'Ana Pérez',
      username: 'ana@jdv.onmicrosoft.com',
      tenantId: 'tenant-9',
      roles: ['admin'],
      scopes: ['orders.read', 'orders.write', 'events.read'],
      accessToken: entraToken,
    });
    expect(session?.expiresAt).toBeInstanceOf(Date);
  });

  it('falls back to token claims when the account has no name or tenant', () => {
    const session = buildSession(entraToken, { username: 'ana@jdv.onmicrosoft.com' });
    expect(session?.name).toBe('Nombre del token');
    expect(session?.tenantId).toBe('tenant-1');
  });

  it('builds a session from the token alone (local profile)', () => {
    const local = makeJwt({ sub: 'local-demo-user', roles: ['viewer'], scope: 'orders.read events.read', exp: secondsFromNow(60) });
    const session = buildSession(local, null);
    expect(session).toMatchObject({ name: 'local-demo-user', username: 'local-demo-user', tenantId: null, roles: ['viewer'] });
  });

  it('returns null when the token cannot be decoded', () => {
    expect(buildSession('no-es-un-jwt', null)).toBeNull();
  });
});

describe('isExpired', () => {
  it('is false before exp and true after it', () => {
    const session = buildSession(entraToken, null);
    expect(session).not.toBeNull();
    expect(isExpired(session!, new Date())).toBe(false);
    expect(isExpired(session!, new Date(Date.now() + 2 * 3600 * 1000))).toBe(true);
  });

  it('treats a token without exp as not expired', () => {
    const session = buildSession(makeJwt({ sub: 'x' }), null);
    expect(isExpired(session!, new Date())).toBe(false);
  });
});
