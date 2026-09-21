import { TokenClaims, decodeJwtPayload, expiryFromClaims, rolesFromClaims, scopesFromClaims } from './jwt';

/** Lo minimo que se toma de la cuenta de MSAL (AccountInfo). */
export interface AccountSummary {
  readonly name?: string;
  readonly username: string;
  readonly tenantId?: string;
}

export interface Session {
  readonly name: string;
  readonly username: string;
  readonly tenantId: string | null;
  readonly roles: string[];
  readonly scopes: string[];
  readonly expiresAt: Date | null;
  readonly accessToken: string;
  readonly claims: TokenClaims;
}

const asText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** Roles y scopes salen de los claims del access token con el que se llama al API. */
export function buildSession(accessToken: string, account: AccountSummary | null): Session | null {
  const claims = decodeJwtPayload(accessToken);
  if (!claims) return null;
  const username = account?.username ?? asText(claims['preferred_username']) ?? asText(claims['sub']) ?? 'usuario';
  return {
    name: account?.name ?? asText(claims['name']) ?? username,
    username,
    tenantId: account?.tenantId ?? asText(claims['tid']),
    roles: rolesFromClaims(claims),
    scopes: scopesFromClaims(claims),
    expiresAt: expiryFromClaims(claims),
    accessToken,
    claims,
  };
}

export function isExpired(session: Session, now: Date = new Date()): boolean {
  return session.expiresAt !== null && session.expiresAt.getTime() <= now.getTime();
}
