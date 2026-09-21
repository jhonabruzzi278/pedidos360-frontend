import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../api/api-client';
import { ApiResult, AuditEvent, WorkOrder } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/session';
import { Dashboard } from './dashboard';

function result<T>(route: string, status: number, data: T | null = null, message: string | null = null): ApiResult<T> {
  return { route, status, ok: status < 400, data, message };
}

const order: WorkOrder = {
  id: 'OT-1', clientId: 'C1', licensePlate: 'AA11', description: 'Mantencion', total: 1000, itemCount: 1, calculatedSubtotal: 1000,
};
const event: AuditEvent = { id: 1, workOrderId: 'OT-1', eventType: 'OtCreada', createdAt: '2026-01-01T00:00:00Z' };
const adminSession = { roles: ['admin'], scopes: ['orders.read', 'orders.write', 'events.read'] } as Session;

function createDashboard(api: Partial<Record<keyof ApiClient, ReturnType<typeof vi.fn>>>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiClient, useValue: api },
      { provide: AuthService, useValue: { session: signal(adminSession) } },
    ],
  });
  const fixture = TestBed.createComponent(Dashboard);
  fixture.detectChanges();
  return fixture;
}

/** load() es una promesa que Angular no rastrea: se deja correr la cola de tareas antes de renderizar. */
async function settle(fixture: ReturnType<typeof createDashboard>): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
  return fixture.nativeElement.textContent as string;
}

describe('Dashboard', () => {
  it('shows the orders, the events, the role and the status of each route', async () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [order])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [event])),
    });
    const text = await settle(fixture);
    expect(text).toContain('OT-1');
    expect(text).toContain('OtCreada');
    expect(text).toContain('admin');
    expect(text).toContain('GET /api/work-orders');
    expect(text).toContain('200 OK');
  });

  it('shows 403 and the message of the API instead of failing the whole page', async () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result<WorkOrder[]>('GET /api/work-orders', 403, null, 'Permisos insuficientes')),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [event])),
    });
    const text = await settle(fixture);
    expect(text).toContain('403 Sin permiso');
    expect(text).toContain('Permisos insuficientes');
    expect(text).toContain('OtCreada');
  });

  it('records the POST result and reloads the list when the order is created', async () => {
    const workOrders = vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [order]));
    const fixture = createDashboard({
      workOrders,
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
      createSampleOrder: vi.fn().mockResolvedValue(result('POST /api/work-orders', 201, order)),
    });
    await settle(fixture);
    await fixture.componentInstance.createSampleOrder();
    const text = await settle(fixture);
    expect(text).toContain('201 Creado');
    expect(workOrders).toHaveBeenCalledTimes(2);
  });

  it('shows the 401 of a call made without a token', async () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
      workOrdersWithoutToken: vi.fn().mockResolvedValue(result<WorkOrder[]>('GET /api/work-orders (sin token)', 401, null, 'Unauthorized')),
    });
    await settle(fixture);
    await fixture.componentInstance.callWithoutToken();
    const text = await settle(fixture);
    expect(text).toContain('GET /api/work-orders (sin token)');
    expect(text).toContain('401 No autenticado');
  });
});
