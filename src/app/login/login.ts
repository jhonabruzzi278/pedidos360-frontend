import { Component } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Component({ selector: 'app-login', templateUrl: './login.html', styleUrl: './login.scss' })
export class Login {
  constructor(readonly auth: AuthService) {}
  login(): void { void this.auth.login(); }
}
