import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { makeJwt, secondsFromNow } from '../testing/jwt-fixtures';
import { AuthService } from './auth.service';

const account = { name: 'Ana Pérez', username: 'ana@jdv.onmicrosoft.com', tenantId: 'tenant-1' } as AccountInfo;
const accessToken = makeJwt({
  aud: 'api-client-id',
  scp: 'orders.read events.read',
  roles: ['admin'],
  exp: secondsFromNow(3600),
});

function createMsal() {
  return {
    instance: {
      getActiveAccount: vi.fn().mockReturnValue(null),
      getAllAccounts: vi.fn().mockReturnValue([]),
      setActiveAccount: vi.fn(),
    },
    initialize: vi.fn(() => of(undefined)),
    handleRedirectObservable: vi.fn(() => of(null)),
    acquireTokenSilent: vi.fn(() => of({ accessToken })),
    loginRedirect: vi.fn(() => of(undefined)),
    logoutRedirect: vi.fn(() => of(undefined)),
  };
}

describe('AuthService (Entra ID)', () => {
  const settings = environment as { authMode: 'local' | 'entra' };
  let msal: ReturnType<typeof createMsal>;

  function createService(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: MsalService, useValue: msal }],
    });
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    settings.authMode = 'entra';
    msal = createMsal();
  });

  afterEach(() => {
    settings.authMode = 'local';
  });

  it('initializes MSAL and processes the redirect response before reading accounts', async () => {
    const auth = createService();
    await auth.restore();
    expect(msal.initialize).toHaveBeenCalledOnce();
    expect(msal.handleRedirectObservable).toHaveBeenCalledOnce();
    expect(msal.initialize.mock.invocationCallOrder[0]).toBeLessThan(msal.handleRedirectObservable.mock.invocationCallOrder[0]);
  });

  it('has no session when there is no account', async () => {
    const auth = createService();
    await auth.restore();
    expect(auth.session()).toBeNull();
    expect(msal.acquireTokenSilent).not.toHaveBeenCalled();
  });

  it('sets the active account and reads roles and scopes from the access token', async () => {
    msal.instance.getAllAccounts.mockReturnValue([account]);
    const auth = createService();
    await auth.restore();

    expect(msal.instance.setActiveAccount).toHaveBeenCalledWith(account);
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith({ scopes: [...environment.entra.apiScopes], account });
    expect(auth.session()).toMatchObject({
      name: 'Ana Pérez',
      username: 'ana@jdv.onmicrosoft.com',
      tenantId: 'tenant-1',
      roles: ['admin'],
      scopes: ['orders.read', 'events.read'],
    });
  });

  it('prefers the active account over the first cached one', async () => {
    const other = { ...account, username: 'otra@jdv.onmicrosoft.com' } as AccountInfo;
    msal.instance.getActiveAccount.mockReturnValue(account);
    msal.instance.getAllAccounts.mockReturnValue([other, account]);
    const auth = createService();
    await auth.restore();
    expect(auth.session()?.username).toBe('ana@jdv.onmicrosoft.com');
  });

  it('reports the failure and stays signed out when the token cannot be acquired', async () => {
    msal.instance.getAllAccounts.mockReturnValue([account]);
    msal.acquireTokenSilent.mockReturnValue(throwError(() => new Error('interaction_required')));
    const auth = createService();
    await auth.restore();
    expect(auth.session()).toBeNull();
    expect(auth.error()).toContain('interaction_required');
  });

  it('starts the login redirect with the API scopes', async () => {
    const auth = createService();
    await auth.login();
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: [...environment.entra.apiScopes] });
    expect(auth.busy()).toBe(false);
  });

  it('starts the sign-up redirect with prompt=create', async () => {
    const auth = createService();
    await auth.signUp();
    expect(msal.loginRedirect).toHaveBeenCalledWith({ scopes: [...environment.entra.apiScopes], prompt: 'create' });
  });

  it('reports an error when the redirect cannot start', async () => {
    msal.loginRedirect.mockReturnValue(throwError(() => new Error('interaction_in_progress')));
    const auth = createService();
    await auth.login();
    expect(auth.error()).toContain('No fue posible iniciar sesión');
    expect(auth.busy()).toBe(false);
  });

  it('logs out through Entra ID and returns to the registered redirect URI', async () => {
    msal.instance.getAllAccounts.mockReturnValue([account]);
    msal.instance.getActiveAccount.mockReturnValue(account);
    const auth = createService();
    await auth.restore();
    await auth.logout();
    expect(auth.session()).toBeNull();
    expect(msal.logoutRedirect).toHaveBeenCalledWith({ account, postLogoutRedirectUri: environment.entra.redirectUri });
  });
});
