import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';
import { makeJwt, secondsFromNow } from '../testing/jwt-fixtures';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'pedidos360.localAccessToken';
const viewerToken = () =>
  makeJwt({ sub: 'local-demo-user', roles: ['viewer'], scope: 'orders.read events.read', exp: secondsFromNow(600) });
const adminToken = () =>
  makeJwt({ sub: 'local-demo-user', roles: ['admin'], scope: 'orders.read orders.write events.read', exp: secondsFromNow(600) });

describe('AuthService (local profile)', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MsalService, useValue: {} },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('runs in the local profile during tests', () => {
    expect(environment.authMode).toBe('local');
  });

  it('starts without a session', async () => {
    await auth.restore();
    expect(auth.session()).toBeNull();
    expect(auth.authenticated()).toBe(false);
  });

  it('restores a session from a stored token, exposing roles and scopes', async () => {
    sessionStorage.setItem(STORAGE_KEY, adminToken());
    await auth.restore();
    expect(auth.authenticated()).toBe(true);
    expect(auth.session()).toMatchObject({ roles: ['admin'], scopes: ['orders.read', 'orders.write', 'events.read'] });
  });

  it('discards an expired token', async () => {
    sessionStorage.setItem(STORAGE_KEY, makeJwt({ sub: 'x', exp: secondsFromNow(-60) }));
    await auth.restore();
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('logs in with the requested role and navigates to the quotes page', async () => {
    const pending = auth.login('admin');
    const request = http.expectOne(`${environment.apiBaseUrl}/dev/token?role=admin`);
    expect(request.request.method).toBe('POST');
    request.flush({ accessToken: adminToken() });
    await pending;
    expect(auth.session()?.roles).toEqual(['admin']);
    expect(navigate).toHaveBeenCalledWith('/cotizaciones');
    expect(auth.busy()).toBe(false);
  });

  it('reports an error and stays signed out when the local token cannot be obtained', async () => {
    const pending = auth.login('viewer');
    http.expectOne(`${environment.apiBaseUrl}/dev/token?role=viewer`).flush('x', { status: 500, statusText: 'Error' });
    await pending;
    expect(auth.authenticated()).toBe(false);
    expect(auth.error()).toContain('No fue posible iniciar sesión');
    expect(auth.busy()).toBe(false);
  });

  it('logs out: clears the token and session and goes back to the start page', async () => {
    sessionStorage.setItem(STORAGE_KEY, viewerToken());
    await auth.restore();
    await auth.logout();
    expect(auth.session()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('exposes the stored local token to the interceptor', () => {
    expect(auth.localToken()).toBeNull();
    const token = viewerToken();
    sessionStorage.setItem(STORAGE_KEY, token);
    expect(auth.localToken()).toBe(token);
  });
});
