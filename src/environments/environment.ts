export const environment = {
  production: false,
  authMode: 'local' as 'local' | 'entra',
  // 127.0.0.1 y no localhost: el BFF local (perfil local) escucha solo en IPv4.
  apiBaseUrl: 'http://127.0.0.1:8080',
  entra: {
    clientId: 'REPLACE_WITH_ENTRA_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/REPLACE_WITH_TENANT_ID',
    redirectUri: 'http://localhost:4200',
    // Muestra el boton "Crear cuenta": en External ID abre el alta (prompt=create); en un tenant workforce
    // es un inicio de sesion normal y el registro lo ofrece Microsoft (ver infra/ENTRA.md del repo backend).
    signUpEnabled: false,
    apiScopes: [
      'api://REPLACE_WITH_API_CLIENT_ID/orders.read',
      'api://REPLACE_WITH_API_CLIENT_ID/orders.write',
      'api://REPLACE_WITH_API_CLIENT_ID/events.read',
    ],
  },
};
