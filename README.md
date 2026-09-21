# Pedidos360 - frontend

Frontend Angular de Pedidos360 (DSY1107, Desarrollo Cloud Native I). Inicia sesion contra un IDaaS (Microsoft Entra ID) con MSAL y usa el JWT en las llamadas al backend. El backend vive en su propio repositorio.

## Requisitos

- Node.js compatible con Angular 22 (validado con Node 24).

## Ejecutar

```bash
npm ci
npm start
```

Abre `http://localhost:4200`. Necesita el backend activo en `http://127.0.0.1:8080` (el BFF local escucha solo en esa direccion).

## Modos de autenticacion

Se elige en `src/environments/`:

| Archivo | `authMode` | Uso |
|---|---|---|
| `environment.ts` | `local` | Desarrollo: pide un token de prueba al BFF local (`POST /dev/token`); no usa Entra ID |
| `environment.production.ts` | `entra` | Produccion: MSAL, `MsalGuard` y `MsalInterceptor` |

El modo `local` solo funciona con el BFF en perfil `local` y no reemplaza la evidencia de Entra ID.

### Conectar con Entra ID

Reemplazar los marcadores `REPLACE_WITH_...` de `environment.production.ts`: `clientId`, `authority` (con el `tenantId`), `redirectUri`, `apiBaseUrl` (URL del API Gateway) y `apiScopes`. Los scopes deben coincidir con los que exige el backend: `orders.read`, `orders.write` y `events.read`.

## Compilar y probar

```bash
npm run build
npm test -- --watch=false
```

## Estructura

```text
src/app/
  auth/        servicio de sesion, guard e interceptor del modo local
  login/       pantalla de inicio de sesion
  dashboard/   ordenes de trabajo y eventos de auditoria
src/environments/
```

## Pendiente

Probar el flujo real contra Entra ID (login, cierre de sesion, renovacion de tokens, lectura de roles y scopes desde los claims) y el flujo de registro de usuarios; requieren el tenant y la aplicacion creados en la nube.
