import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  MSAL_GUARD_CONFIG, MSAL_INSTANCE, MSAL_INTERCEPTOR_CONFIG, MsalBroadcastService,
  MsalGuard, MsalGuardConfiguration, MsalInterceptor, MsalInterceptorConfiguration,
  MsalModule, MsalService,
} from '@azure/msal-angular';
import { BrowserCacheLocation, InteractionType, IPublicClientApplication, PublicClientApplication } from '@azure/msal-browser';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { localTokenInterceptor } from './auth/local-token.interceptor';

// Un tenant External ID emite desde <subdominio>.ciamlogin.com: MSAL debe conocer esa autoridad.
function knownAuthorities(authority: string): string[] {
  const host = new URL(authority).hostname;
  return host.endsWith('.ciamlogin.com') ? [host] : [];
}

// MSAL usa Authorization Code con PKCE (S256), state y nonce por defecto; el frontend no maneja secretos.
function msalInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: environment.entra.clientId,
      authority: environment.entra.authority,
      knownAuthorities: knownAuthorities(environment.entra.authority),
      redirectUri: environment.entra.redirectUri,
      // Debe estar registrada como URI de redireccion: al cerrar sesion se vuelve a la pagina de inicio.
      postLogoutRedirectUri: environment.entra.redirectUri,
    },
    cache: { cacheLocation: BrowserCacheLocation.SessionStorage },
  });
}

function guardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: { scopes: [...environment.entra.apiScopes] },
    loginFailedRoute: '/',
  };
}

// El interceptor pide en silencio el access token del API y lo adjunta a cada llamada a /api/*.
function interceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  if (environment.authMode === 'entra') {
    protectedResourceMap.set(`${environment.apiBaseUrl}/api/*`, [...environment.entra.apiScopes]);
  }
  return { interactionType: InteractionType.Redirect, protectedResourceMap };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), provideRouter(routes),
    provideHttpClient(withInterceptors([localTokenInterceptor]), withInterceptorsFromDi()),
    importProvidersFrom(MsalModule),
    { provide: MSAL_INSTANCE, useFactory: msalInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useFactory: guardConfigFactory },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: interceptorConfigFactory },
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
    MsalService, MsalGuard, MsalBroadcastService,
  ],
};
