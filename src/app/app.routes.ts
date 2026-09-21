import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { environment } from '../environments/environment';
import { authGuard } from './auth/auth.guard';
import { Dashboard } from './dashboard/dashboard';
import { Login } from './login/login';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: '', component: Dashboard, canActivate: environment.authMode === 'entra' ? [MsalGuard] : [authGuard] },
  { path: '**', redirectTo: '' },
];
