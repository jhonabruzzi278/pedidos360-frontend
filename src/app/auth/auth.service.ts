import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const LOCAL_TOKEN_KEY = 'pedidos360.localAccessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly authenticated = signal(false);
  readonly busy = signal(false);

  constructor(private http: HttpClient, private msal: MsalService, private router: Router) {
    this.authenticated.set(this.hasSession());
  }

  async login(): Promise<void> {
    this.busy.set(true);
    try {
      if (environment.authMode === 'local') {
        const response = await firstValueFrom(this.http.post<{ accessToken: string }>(`${environment.apiBaseUrl}/dev/token`, {}));
        sessionStorage.setItem(LOCAL_TOKEN_KEY, response.accessToken);
        this.authenticated.set(true);
        await this.router.navigateByUrl('/');
        return;
      }
      await this.msal.instance.initialize();
      await this.msal.loginRedirect({ scopes: environment.entra.apiScopes });
    } finally { this.busy.set(false); }
  }

  async logout(): Promise<void> {
    if (environment.authMode === 'local') {
      sessionStorage.removeItem(LOCAL_TOKEN_KEY);
      this.authenticated.set(false);
      await this.router.navigateByUrl('/login');
      return;
    }
    await this.msal.logoutRedirect();
  }

  localToken(): string | null { return sessionStorage.getItem(LOCAL_TOKEN_KEY); }

  private hasSession(): boolean {
    return environment.authMode === 'local'
      ? Boolean(sessionStorage.getItem(LOCAL_TOKEN_KEY))
      : this.msal.instance.getAllAccounts().length > 0;
  }
}
