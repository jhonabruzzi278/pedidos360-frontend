import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { ApiResult, AuditEvent, WorkOrder, formatClp, statusLabel } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { NewOrder } from './new-order/new-order';

@Component({ selector: 'app-dashboard', imports: [NewOrder], templateUrl: './dashboard.html', styleUrl: './dashboard.scss' })
export class Dashboard implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  readonly orders = signal<WorkOrder[]>([]);
  readonly events = signal<AuditEvent[]>([]);
  readonly loading = signal(true);
  /** Ultimo resultado de cada llamada, por ruta: es la evidencia de 200/201/401/403 que se muestra en pantalla. */
  private readonly resultsByRoute = signal<Readonly<Record<string, ApiResult<unknown>>>>({});
  readonly results = computed(() => Object.values(this.resultsByRoute()));
  readonly roleText = computed(() => this.auth.session()?.roles.join(', ') || 'sin rol');
  readonly statusLabel = statusLabel;
  readonly formatClp = formatClp;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const [orders, events] = await Promise.all([this.api.workOrders(), this.api.events()]);
    this.record(orders);
    this.record(events);
    this.orders.set(orders.data ?? []);
    this.events.set(events.data ?? []);
    this.loading.set(false);
  }

  /** El formulario ya hizo el POST: aqui se anota su resultado como evidencia y se recarga la lista si se creo. */
  async onCreated(result: ApiResult<WorkOrder>): Promise<void> {
    this.record(result);
    if (result.ok) await this.load();
  }

  /** Las tres rutas sin token: cada una debe responder 401. */
  async callWithoutToken(): Promise<void> {
    this.recordAll(await this.api.withoutToken());
  }

  /** Las tres rutas con el token de la sesion pero con la firma alterada: cada una debe responder 401. */
  async callWithTamperedToken(): Promise<void> {
    const token = this.auth.session()?.accessToken;
    if (token) this.recordAll(await this.api.withTamperedToken(token));
  }

  bodyText(result: ApiResult<unknown>): string {
    return result.body === null || result.body === undefined ? 'Sin cuerpo en la respuesta' : JSON.stringify(result.body, null, 2);
  }

  private record(result: ApiResult<unknown>): void {
    this.recordAll([result]);
  }

  private recordAll(results: readonly ApiResult<unknown>[]): void {
    this.resultsByRoute.update((current) => ({
      ...current,
      ...Object.fromEntries(results.map((result) => [result.route, result])),
    }));
  }
}
