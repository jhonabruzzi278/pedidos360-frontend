import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AccessRequirements, evaluateAccess } from './permissions';

/**
 * Autoriza la ruta con los roles y scopes de los claims del token. Se declaran en `data.access`.
 * Sin sesion vuelve al inicio; con sesion pero sin permisos va a /acceso-denegado. Es solo control de
 * navegacion: API Gateway y el BFF vuelven a validar cada llamada.
 */
export const permissionGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restore();

  const session = auth.session();
  if (!session) return router.createUrlTree(['/']);

  const required = (route.data['access'] ?? {}) as AccessRequirements;
  const decision = evaluateAccess(session, required);
  if (decision.allowed) return true;

  return router.createUrlTree(['/acceso-denegado'], {
    queryParams: { scopes: decision.missingScopes.join(' ') || null, roles: decision.missingRoles.join(' ') || null },
  });
};
