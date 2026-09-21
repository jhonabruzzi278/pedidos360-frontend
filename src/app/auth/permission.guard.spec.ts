import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { permissionGuard } from './permission.guard';
import { Session } from './session';

function sessionWith(scopes: string[], roles: string[]): Session {
  return { name: 'Ana', username: 'ana', tenantId: null, roles, scopes, expiresAt: null, accessToken: 't', claims: {} };
}

function runGuard(session: Session | null, access?: object): Promise<boolean | UrlTree> {
  const auth = { restore: vi.fn().mockResolvedValue(undefined), session: signal(session) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  const route = { data: access ? { access } : {} } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot)) as Promise<boolean | UrlTree>;
}

describe('permissionGuard', () => {
  it('sends anonymous users to the start page', async () => {
    const result = await runGuard(null, { scopes: ['orders.read'] });
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  it('lets the user in when the route declares no requirements', async () => {
    expect(await runGuard(sessionWith([], []))).toBe(true);
  });

  it('lets the user in when scopes and roles are granted', async () => {
    const session = sessionWith(['orders.read', 'orders.write'], ['admin']);
    expect(await runGuard(session, { scopes: ['orders.read', 'orders.write'], roles: ['admin'] })).toBe(true);
  });

  it('redirects to the access-denied page listing what is missing', async () => {
    const result = await runGuard(sessionWith(['orders.read'], []), { scopes: ['orders.read', 'events.read'], roles: ['admin'] });
    const url = TestBed.inject(Router).serializeUrl(result as UrlTree);
    expect(url).toBe('/acceso-denegado?scopes=events.read&roles=admin');
  });
});
