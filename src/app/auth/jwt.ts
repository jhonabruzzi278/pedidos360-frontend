/**
 * Lectura de los claims de un JWT. Solo sirve para MOSTRAR y para decidir la navegacion: la firma no se
 * verifica aqui. La autorizacion real la hacen API Gateway y el BFF.
 */
export type TokenClaims = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const unique = (values: readonly string[]): string[] => [...new Set(values)];

function splitList(value: unknown): string[] {
  if (isString(value)) return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) return value.filter(isString);
  return [];
}

export function decodeJwtPayload(token: string): TokenClaims | null {
  const segments = token.split('.');
  if (segments.length !== 3 || segments[1] === '') return null;
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** Entra ID usa `scp`; el perfil local del BFF usa `scope`. Ambos son cadenas separadas por espacios. */
export function scopesFromClaims(claims: TokenClaims): string[] {
  return unique([...splitList(claims['scp']), ...splitList(claims['scope'])]);
}

export function rolesFromClaims(claims: TokenClaims): string[] {
  return unique(splitList(claims['roles']));
}

export function expiryFromClaims(claims: TokenClaims): Date | null {
  const exp = claims['exp'];
  return typeof exp === 'number' && Number.isFinite(exp) ? new Date(exp * 1000) : null;
}

/**
 * Devuelve el mismo token con la firma alterada: los claims siguen intactos, pero la firma ya no corresponde.
 * Sirve para demostrar que el API Manager verifica la firma y no solo la forma del token. Se cambia el primer
 * caracter de la firma porque el ultimo lleva bits de relleno y podria decodificar igual.
 */
export function withTamperedSignature(token: string): string {
  const segments = token.split('.');
  if (segments.length !== 3 || segments[2] === '') return `${token}x`;
  const [header, payload, signature] = segments;
  const swapped = signature[0] === 'A' ? 'B' : 'A';
  return `${header}.${payload}.${swapped}${signature.slice(1)}`;
}
