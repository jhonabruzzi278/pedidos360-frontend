import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../api/api-client';
import { ApiLog } from '../api/api-log';
import { ApiResult, statusLabel } from '../api/api.models';
import { AuthService } from '../auth/auth.service';

/**
 * Pagina tecnica para la presentacion: el codigo y el JSON de cada llamada que hizo la aplicacion y las pruebas de
 * seguridad (sin token, token alterado) sobre todas las rutas. Es la evidencia de que API Gateway y el BFF validan
 * el JWT, separada de las pantallas de la aplicacion.
 */
@Component({
  selector: 'app-diagnostics-page',
  imports: [RouterLink],
  templateUrl: './diagnostics-page.html',
  styleUrl: './diagnostics-page.scss',
})
export class DiagnosticsPage {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  readonly results = inject(ApiLog).results;
  readonly running = signal(false);
  readonly statusLabel = statusLabel;

  /** Las tres rutas de lectura con la sesion actual: no crean ni modifican nada. */
  async runReads(): Promise<void> {
    await this.run(() => Promise.all([this.api.workOrders(), this.api.events(), this.api.accessMine()]));
  }

  async callWithoutToken(): Promise<void> {
    await this.run(() => this.api.withoutToken());
  }

  async callWithTamperedToken(): Promise<void> {
    const token = this.auth.session()?.accessToken;
    if (token) await this.run(() => this.api.withTamperedToken(token));
  }

  bodyText(result: ApiResult<unknown>): string {
    return result.body === null || result.body === undefined ? 'Sin cuerpo en la respuesta' : JSON.stringify(result.body, null, 2);
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.running.set(true);
    try {
      await action();
    } finally {
      this.running.set(false);
    }
  }
}
