// Sustituye los marcadores REPLACE_WITH_* de src/environments/environment.production.ts con los valores
// reales (tenant, aplicaciones de Entra ID, URL del API Gateway y del propio frontend) antes de compilar.
// Uso: variables de entorno + `node scripts/configure-environment.mjs`. Lo ejecuta el workflow frontend-deploy.
import { readFileSync, writeFileSync } from 'node:fs';

const TARGET = 'src/environments/environment.production.ts';
// Solo caracteres de URL y GUID: los valores terminan dentro de codigo fuente TypeScript.
const SAFE_VALUE = /^[A-Za-z0-9:/._-]+$/;

const read = (name) => (process.env[name] ?? '').trim();

const tenantId = read('ENTRA_TENANT_ID');
const values = {
  API_BASE_URL: read('API_BASE_URL'),
  FRONTEND_URL: read('FRONTEND_URL'),
  ENTRA_CLIENT_ID: read('ENTRA_CLIENT_ID'),
  ENTRA_API_CLIENT_ID: read('ENTRA_API_CLIENT_ID'),
  AUTHORITY: read('ENTRA_AUTHORITY') || (tenantId ? `https://login.microsoftonline.com/${tenantId}` : ''),
};

const labels = { AUTHORITY: 'ENTRA_TENANT_ID (o ENTRA_AUTHORITY)' };
const missing = Object.entries(values)
  .filter(([, value]) => !value)
  .map(([key]) => labels[key] ?? key);
if (missing.length > 0) {
  console.error(`Faltan valores de configuracion: ${missing.join(', ')}`);
  process.exit(1);
}

const invalid = Object.entries(values).filter(([, value]) => !SAFE_VALUE.test(value));
if (invalid.length > 0) {
  console.error(`Valores con caracteres no permitidos: ${invalid.map(([key]) => key).join(', ')}`);
  process.exit(1);
}

const replacements = [
  ['REPLACE_WITH_API_GATEWAY_URL', values.API_BASE_URL],
  ['REPLACE_WITH_FRONTEND_URL', values.FRONTEND_URL],
  ['REPLACE_WITH_ENTRA_CLIENT_ID', values.ENTRA_CLIENT_ID],
  ['REPLACE_WITH_API_CLIENT_ID', values.ENTRA_API_CLIENT_ID],
];

// Opcional: muestra el boton "Crear cuenta" (External ID: alta con prompt=create; workforce: inicio de sesion normal).
const signUpEnabled = read('ENTRA_SIGNUP_ENABLED').toLowerCase() === 'true';

let source = readFileSync(TARGET, 'utf8');
// La autoridad completa (workforce o External ID) se reemplaza como una unidad.
source = source.replace(/authority: '[^']*'/, `authority: '${values.AUTHORITY}'`);
source = source.replace(/signUpEnabled: (true|false)/, `signUpEnabled: ${signUpEnabled}`);
for (const [marker, value] of replacements) {
  source = source.split(marker).join(value);
}

if (source.includes('REPLACE_WITH_')) {
  console.error('Quedaron marcadores REPLACE_WITH_* sin sustituir en', TARGET);
  process.exit(1);
}

writeFileSync(TARGET, source);
console.log(`${TARGET} configurado (authority=${values.AUTHORITY}, api=${values.API_BASE_URL})`);
