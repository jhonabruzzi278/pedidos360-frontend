import { Injectable, computed, signal } from '@angular/core';
import { ApiResult } from './api.models';

/**
 * Ultimo resultado de cada llamada al API, por ruta. Lo alimenta ApiClient y solo lo lee la pagina de
 * Diagnostico: es la evidencia de 200/201/401/403 sin que ninguna pantalla de la aplicacion la muestre.
 */
@Injectable({ providedIn: 'root' })
export class ApiLog {
  private readonly byRoute = signal<Readonly<Record<string, ApiResult<unknown>>>>({});
  readonly results = computed(() => Object.values(this.byRoute()));

  record(result: ApiResult<unknown>): void {
    this.byRoute.update((current) => ({ ...current, [result.route]: result }));
  }

  clear(): void {
    this.byRoute.set({});
  }
}
