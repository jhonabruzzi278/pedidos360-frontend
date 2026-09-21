import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({ selector: 'app-login', templateUrl: './login.html', styleUrl: './login.scss' })
export class Login {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // Al volver de Entra ID (o si ya hay sesion) se pasa directo a las ordenes.
    effect(() => {
      if (this.auth.authenticated()) void this.router.navigateByUrl('/ordenes');
    });
  }
}
