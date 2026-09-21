import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { environment } from '../environments/environment';
import { permissionGuard } from './auth/permission.guard';
import { Dashboard } from './dashboard/dashboard';
import { Forbidden } from './forbidden/forbidden';
import { Login } from './login/login';
import { Profile } from './profile/profile';

// En Entra ID, MsalGuard exige una cuenta (redirige al login si falta) y luego permissionGuard revisa los
// roles y scopes de los claims. En el perfil local solo actua permissionGuard.
const protectedRoute = environment.authMode === 'entra' ? [MsalGuard, permissionGuard] : [permissionGuard];

export const routes: Routes = [
  { path: '', component: Login },
  {
    path: 'ordenes',
    component: Dashboard,
    canActivate: protectedRoute,
    data: { access: { scopes: ['orders.read', 'events.read'] } },
  },
  { path: 'perfil', component: Profile, canActivate: protectedRoute },
  { path: 'acceso-denegado', component: Forbidden },
  { path: '**', redirectTo: '' },
];
