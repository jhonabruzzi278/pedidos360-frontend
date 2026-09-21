import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const localTokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (environment.authMode !== 'local' || !request.url.startsWith(`${environment.apiBaseUrl}/api/`)) return next(request);
  const token = inject(AuthService).localToken();
  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};
