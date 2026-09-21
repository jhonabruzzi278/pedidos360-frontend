import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  readonly auth = inject(AuthService);
  readonly isAdmin = computed(() => this.auth.session()?.roles.includes('admin') ?? false);

  ngOnInit(): void {
    // Procesa la respuesta de la redireccion de login y carga la sesion antes de que el usuario navegue.
    void this.auth.restore();
  }

  logout(): void {
    void this.auth.logout();
  }
}
