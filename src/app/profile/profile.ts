import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Component({ imports: [DatePipe], selector: 'app-profile', templateUrl: './profile.html' })
export class Profile {
  readonly session = inject(AuthService).session;
  readonly claimsJson = computed(() => JSON.stringify(this.session()?.claims ?? {}, null, 2));
  readonly copyMessage = signal('');

  async copyToken(): Promise<void> {
    const session = this.session();
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.accessToken);
      this.copyMessage.set('Token copiado al portapapeles.');
    } catch {
      this.copyMessage.set('No fue posible copiar el token: el navegador bloqueó el portapapeles.');
    }
  }
}
