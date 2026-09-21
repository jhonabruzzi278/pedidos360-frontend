import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { ApiResult, AuditEvent, WorkOrder, statusLabel } from '../api/api.models';
import { AuthService } from '../auth/auth.service';

@Component({ selector: 'app-dashboard', templateUrl: './dashboard.html', styleUrl: './dashboard.scss' })
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

  async createSampleOrder(): Promise<void> {
    const result = await this.api.createSampleOrder();
    this.record(result);
    if (result.ok) await this.load();
  }

  async callWithoutToken(): Promise<void> {
    this.record(await this.api.workOrdersWithoutToken());
  }

  private record(result: ApiResult<unknown>): void {
    this.resultsByRoute.update((current) => ({ ...current, [result.route]: result }));
  }
}
