export interface GrantedAccess {
  readonly scopes: readonly string[];
  readonly roles: readonly string[];
}

/** Scopes: se exigen todos. Roles: basta uno de la lista. */
export interface AccessRequirements {
  readonly scopes?: readonly string[];
  readonly roles?: readonly string[];
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly missingScopes: string[];
  readonly missingRoles: string[];
}

export function evaluateAccess(granted: GrantedAccess, required: AccessRequirements): AccessDecision {
  const missingScopes = (required.scopes ?? []).filter((scope) => !granted.scopes.includes(scope));
  const requiredRoles = required.roles ?? [];
  const hasRole = requiredRoles.length === 0 || requiredRoles.some((role) => granted.roles.includes(role));
  const missingRoles = hasRole ? [] : [...requiredRoles];
  return { allowed: missingScopes.length === 0 && hasRole, missingScopes, missingRoles };
}
