import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Session, buildSession, isExpired } from './session';

const LOCAL_TOKEN_KEY = 'pedidos360.localAccessToken';

export type LocalRole = 'viewer' | 'admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly msal = inject(MsalService);
  private readonly router = inject(Router);

  readonly mode = environment.authMode;
  readonly signUpEnabled = environment.authMode === 'entra' && environment.entra.signUpEnabled;
  readonly session = signal<Session | null>(null);
  readonly authenticated = computed(() => this.session() !== null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  private restoring: Promise<void> | null = null;

  /**
   * Carga la sesion existente. En Entra ID tambien procesa la respuesta de la redireccion de login
   * (Authorization Code + PKCE) y fija la cuenta activa. Es idempotente: las llamadas comparten una promesa.
   */
  restore(): Promise<void> {
    this.restoring ??= this.load();
    return this.restoring;
  }

  async login(localRole: LocalRole = 'viewer'): Promise<void> {
    await this.run('No fue posible iniciar sesión.', async () => {
      if (this.mode === 'local') {
        const response = await firstValueFrom(
          this.http.post<{ accessToken: string }>(`${environment.apiBaseUrl}/dev/token?role=${localRole}`, {}),
        );
        sessionStorage.setItem(LOCAL_TOKEN_KEY, response.accessToken);
        await this.reload();
        await this.router.navigateByUrl('/ordenes');
        return;
      }
      await firstValueFrom(this.msal.loginRedirect({ scopes: [...environment.entra.apiScopes] }));
    });
  }

  /** Registro de cuenta: `prompt=create` abre el formulario de alta del tenant (External ID). */
  async signUp(): Promise<void> {
    await this.run('No fue posible abrir el registro de cuenta.', async () => {
      await firstValueFrom(this.msal.loginRedirect({ scopes: [...environment.entra.apiScopes], prompt: 'create' }));
    });
  }

  async logout(): Promise<void> {
    if (this.mode === 'local') {
      sessionStorage.removeItem(LOCAL_TOKEN_KEY);
      this.session.set(null);
      await this.router.navigateByUrl('/');
      return;
    }
    const account = this.msal.instance.getActiveAccount() ?? undefined;
    this.session.set(null);
    await firstValueFrom(this.msal.logoutRedirect({ account, postLogoutRedirectUri: environment.entra.redirectUri }));
  }

  /** Token del perfil local; el interceptor lo adjunta a las llamadas al BFF local. */
  localToken(): string | null {
    return sessionStorage.getItem(LOCAL_TOKEN_KEY);
  }

  private reload(): Promise<void> {
    this.restoring = null;
    return this.restore();
  }

  private async load(): Promise<void> {
    try {
      this.session.set(this.mode === 'local' ? this.loadLocalSession() : await this.loadEntraSession());
    } catch (error) {
      this.session.set(null);
      this.error.set(`No se pudo obtener el token: ${error instanceof Error ? error.message : 'error desconocido'}`);
    }
  }

  private loadLocalSession(): Session | null {
    const token = sessionStorage.getItem(LOCAL_TOKEN_KEY);
    const session = token ? buildSession(token, null) : null;
    if (token && (!session || isExpired(session))) sessionStorage.removeItem(LOCAL_TOKEN_KEY);
    return session && !isExpired(session) ? session : null;
  }

  private async loadEntraSession(): Promise<Session | null> {
    await firstValueFrom(this.msal.initialize());
    await firstValueFrom(this.msal.handleRedirectObservable());
    const account = this.activeAccount();
    if (!account) return null;
    this.msal.instance.setActiveAccount(account);
    const result = await firstValueFrom(
      this.msal.acquireTokenSilent({ scopes: [...environment.entra.apiScopes], account }),
    );
    return buildSession(result.accessToken, account);
  }

  private activeAccount(): AccountInfo | null {
    return this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0] ?? null;
  }

  private async run(failureMessage: string, action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch {
      this.error.set(failureMessage);
    } finally {
      this.busy.set(false);
    }
  }
}
