import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { environment } from '../environments/environment';
import { AccessRequestsPage } from './access/access-requests-page';
import { permissionGuard } from './auth/permission.guard';
import { DiagnosticsPage } from './diagnostics/diagnostics-page';
import { Forbidden } from './forbidden/forbidden';
import { Login } from './login/login';
import { Profile } from './profile/profile';
import { QuotesPage } from './quotes/quotes-page';

// En Entra ID, MsalGuard exige una cuenta (redirige al login si falta) y luego permissionGuard revisa los
// roles y scopes de los claims. En el perfil local solo actua permissionGuard.
const protectedRoute = environment.authMode === 'entra' ? [MsalGuard, permissionGuard] : [permissionGuard];

export const routes: Routes = [
  { path: '', component: Login },
  {
    path: 'cotizaciones',
    component: QuotesPage,
    canActivate: protectedRoute,
    data: { access: { scopes: ['orders.read'] } },
  },
  {
    // Solo el administrador ve y decide las solicitudes de acceso.
    path: 'solicitudes',
    component: AccessRequestsPage,
    canActivate: protectedRoute,
    data: { access: { scopes: ['orders.read'], roles: ['admin'] } },
  },
  {
    path: 'diagnostico',
    component: DiagnosticsPage,
    canActivate: protectedRoute,
    data: { access: { scopes: ['orders.read', 'events.read'] } },
  },
  { path: 'perfil', component: Profile, canActivate: protectedRoute },
  { path: 'ordenes', redirectTo: 'cotizaciones' },
  { path: 'acceso-denegado', component: Forbidden },
  { path: '**', redirectTo: '' },
];
