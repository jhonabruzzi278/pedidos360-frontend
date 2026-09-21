/** Utilidades solo para pruebas: arman JWT sin firma valida (el frontend nunca verifica la firma). */
function base64Url(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function makeJwt(payload: object): string {
  return `${base64Url({ alg: 'RS256', typ: 'JWT' })}.${base64Url(payload)}.firma`;
}

export function secondsFromNow(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}
