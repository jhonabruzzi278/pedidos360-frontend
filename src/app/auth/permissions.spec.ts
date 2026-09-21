import { evaluateAccess } from './permissions';

const viewer = { scopes: ['orders.read', 'events.read'], roles: [] as string[] };
const admin = { scopes: ['orders.read', 'orders.write', 'events.read'], roles: ['admin'] };

describe('evaluateAccess', () => {
  it('allows access when nothing is required', () => {
    expect(evaluateAccess(viewer, {})).toEqual({ allowed: true, missingScopes: [], missingRoles: [] });
  });

  it('requires every listed scope', () => {
    expect(evaluateAccess(viewer, { scopes: ['orders.read', 'events.read'] }).allowed).toBe(true);
    const denied = evaluateAccess(viewer, { scopes: ['orders.read', 'orders.write'] });
    expect(denied).toEqual({ allowed: false, missingScopes: ['orders.write'], missingRoles: [] });
  });

  it('requires at least one of the listed roles', () => {
    expect(evaluateAccess(admin, { roles: ['admin'] }).allowed).toBe(true);
    expect(evaluateAccess(admin, { roles: ['auditor', 'admin'] }).allowed).toBe(true);
    const denied = evaluateAccess(viewer, { roles: ['admin'] });
    expect(denied).toEqual({ allowed: false, missingScopes: [], missingRoles: ['admin'] });
  });

  it('reports missing scopes and roles together', () => {
    const denied = evaluateAccess({ scopes: [], roles: [] }, { scopes: ['orders.read'], roles: ['admin'] });
    expect(denied).toEqual({ allowed: false, missingScopes: ['orders.read'], missingRoles: ['admin'] });
  });

  it('does not mutate its inputs', () => {
    const granted = { scopes: ['a'], roles: ['r'] };
    const required = { scopes: ['a', 'b'], roles: ['x'] };
    evaluateAccess(granted, required);
    expect(granted).toEqual({ scopes: ['a'], roles: ['r'] });
    expect(required).toEqual({ scopes: ['a', 'b'], roles: ['x'] });
  });
});
