export const environment = {
  production: true,
  authMode: 'entra' as 'local' | 'entra',
  apiBaseUrl: 'REPLACE_WITH_API_GATEWAY_URL',
  entra: {
    clientId: 'REPLACE_WITH_ENTRA_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/REPLACE_WITH_TENANT_ID',
    redirectUri: 'REPLACE_WITH_FRONTEND_URL',
    apiScopes: [
      'api://REPLACE_WITH_API_CLIENT_ID/orders.read',
      'api://REPLACE_WITH_API_CLIENT_ID/orders.write',
      'api://REPLACE_WITH_API_CLIENT_ID/events.read',
    ],
  },
};
