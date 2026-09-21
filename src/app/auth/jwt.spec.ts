import { makeJwt } from '../testing/jwt-fixtures';
import { decodeJwtPayload, expiryFromClaims, rolesFromClaims, scopesFromClaims, withTamperedSignature } from './jwt';

describe('decodeJwtPayload', () => {
  it('returns the payload of a well-formed token', () => {
    const claims = decodeJwtPayload(makeJwt({ sub: 'u1', aud: 'api' }));
    expect(claims).toEqual({ sub: 'u1', aud: 'api' });
  });

  it('decodes base64url without padding and UTF-8 characters', () => {
    const claims = decodeJwtPayload(makeJwt({ name: 'Ñandú Pérez ✓', pad: '???>>>' }));
    expect(claims?.['name']).toBe('Ñandú Pérez ✓');
    expect(claims?.['pad']).toBe('???>>>');
  });

  it.each([
    ['empty string', ''],
    ['no segments', 'abc'],
    ['two segments', 'a.b'],
    ['four segments', 'a.b.c.d'],
    ['empty payload', 'a..c'],
    ['payload that is not base64', 'a.@@@.c'],
    ['payload that is not JSON', `a.${btoa('no es json')}.c`],
    ['payload that is a JSON array', `a.${btoa('[1,2]')}.c`],
    ['payload that is a JSON number', `a.${btoa('42')}.c`],
  ])('returns null for %s', (_label, token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });
});

describe('scopesFromClaims', () => {
  it('splits the space-separated scp claim used by Entra ID', () => {
    expect(scopesFromClaims({ scp: 'orders.read events.read' })).toEqual(['orders.read', 'events.read']);
  });

  it('reads the scope claim used by the local profile', () => {
    expect(scopesFromClaims({ scope: 'orders.read orders.write' })).toEqual(['orders.read', 'orders.write']);
  });

  it('merges scp and scope without duplicates', () => {
    expect(scopesFromClaims({ scp: 'a b', scope: 'b c' })).toEqual(['a', 'b', 'c']);
  });

  it('accepts an array and ignores non-string entries and extra whitespace', () => {
    expect(scopesFromClaims({ scp: ['a', 7, 'b'] })).toEqual(['a', 'b']);
    expect(scopesFromClaims({ scp: '  a   b ' })).toEqual(['a', 'b']);
  });

  it('returns an empty list when there are no scopes', () => {
    expect(scopesFromClaims({})).toEqual([]);
    expect(scopesFromClaims({ scp: 42 })).toEqual([]);
  });
});

describe('rolesFromClaims', () => {
  it('reads the roles array', () => {
    expect(rolesFromClaims({ roles: ['admin', 'viewer'] })).toEqual(['admin', 'viewer']);
  });

  it('accepts a single string and ignores non-string entries', () => {
    expect(rolesFromClaims({ roles: 'admin' })).toEqual(['admin']);
    expect(rolesFromClaims({ roles: ['admin', null, 3] })).toEqual(['admin']);
  });

  it('returns an empty list when there are no roles', () => {
    expect(rolesFromClaims({})).toEqual([]);
    expect(rolesFromClaims({ roles: {} })).toEqual([]);
  });
});

describe('expiryFromClaims', () => {
  it('converts exp (seconds) into a Date', () => {
    expect(expiryFromClaims({ exp: 1_800_000_000 })?.toISOString()).toBe('2027-01-15T08:00:00.000Z');
  });

  it('returns null when exp is missing or invalid', () => {
    expect(expiryFromClaims({})).toBeNull();
    expect(expiryFromClaims({ exp: '1800000000' })).toBeNull();
    expect(expiryFromClaims({ exp: Number.NaN })).toBeNull();
  });
});

describe('withTamperedSignature', () => {
  it('keeps header and payload and changes only the signature', () => {
    const token = 'aaa.bbb.Ccc';
    const tampered = withTamperedSignature(token);
    expect(tampered).not.toBe(token);
    expect(tampered.split('.').slice(0, 2)).toEqual(['aaa', 'bbb']);
    expect(tampered.split('.')[2]).toHaveLength(3);
    expect(tampered.split('.')[2]).not.toBe('Ccc');
  });

  it('keeps the claims readable', () => {
    const token = makeJwt({ sub: 'u1' });
    expect(decodeJwtPayload(withTamperedSignature(token))).toEqual({ sub: 'u1' });
  });

  it('alters a signature that starts with A as well', () => {
    expect(withTamperedSignature('h.p.Axyz')).toBe('h.p.Bxyz');
  });

  it('still changes a token that is not a JWT', () => {
    expect(withTamperedSignature('no-es-jwt')).not.toBe('no-es-jwt');
  });
});
