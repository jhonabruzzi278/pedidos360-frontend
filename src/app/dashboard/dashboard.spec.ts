import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../api/api-client';
import { ApiResult, AuditEvent, WorkOrder } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/session';
import { Dashboard } from './dashboard';

function result<T>(route: string, status: number, data: T | null = null, message: string | null = null): ApiResult<T> {
  return { route, status, ok: status < 400, data, message, body: data ?? (message ? { message } : null) };
}

const order: WorkOrder = {
  id: 'OT-1', clientId: 'C1', licensePlate: 'AA11', description: 'Mantencion', total: 1000, itemCount: 1, calculatedSubtotal: 1000,
};
const event: AuditEvent = { id: 1, workOrderId: 'OT-1', eventType: 'OtCreada', createdAt: '2026-01-01T00:00:00Z' };
const adminSession = { roles: ['admin'], scopes: ['orders.read', 'orders.write', 'events.read'], accessToken: 'h.p.sig' } as Session;

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
    });
    await settle(fixture);
    await fixture.componentInstance.onCreated(result('POST /api/work-orders', 201, order));
    const text = await settle(fixture);
    expect(text).toContain('201 Creado');
    expect(workOrders).toHaveBeenCalledTimes(2);
  });

  it('records a rejected POST as evidence without reloading the list', async () => {
    const workOrders = vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [order]));
    const fixture = createDashboard({
      workOrders,
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
    });
    await settle(fixture);
    await fixture.componentInstance.onCreated(result<WorkOrder>('POST /api/work-orders', 403, null, 'Permisos insuficientes'));
    const text = await settle(fixture);
    expect(text).toContain('POST /api/work-orders');
    expect(text).toContain('403 Sin permiso');
    expect(workOrders).toHaveBeenCalledTimes(1);
  });

  it('shows the totals in Chilean pesos', async () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [{ ...order, total: 91400 }])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
    });
    const text = await settle(fixture);
    expect(text).toMatch(/\$\s?91\.400/);
  });

  it('embeds the form to create an order', async () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
    });
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('app-new-order form')).not.toBeNull();
  });

  it('shows a 401 for each of the three routes when called without a token', async () => {
    const withoutToken = vi.fn().mockResolvedValue([
      result<unknown>('GET /api/work-orders (sin token)', 401, null, 'Unauthorized'),
      result<unknown>('GET /api/events (sin token)', 401, null, 'Unauthorized'),
      result<unknown>('POST /api/work-orders (sin token)', 401, null, 'Unauthorized'),
    ]);
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
      withoutToken,
    });
    await settle(fixture);
    await fixture.componentInstance.callWithoutToken();
    const text = await settle(fixture);
    expect(text).toContain('GET /api/work-orders (sin token)');
    expect(text).toContain('GET /api/events (sin token)');
    expect(text).toContain('POST /api/work-orders (sin token)');
    expect(text.match(/401 No autenticado/g)).toHaveLength(3);
  });

  it('sends the session token with a tampered signature and shows the three 401', async () => {
    const withTamperedToken = vi.fn().mockResolvedValue([
      result<unknown>('GET /api/work-orders (token alterado)', 401, null, 'Unauthorized'),
      result<unknown>('GET /api/events (token alterado)', 401, null, 'Unauthorized'),
      result<unknown>('POST /api/work-orders (token alterado)', 401, null, 'Unauthorized'),
    ]);
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
      withTamperedToken,
    });
    await settle(fixture);
    await fixture.componentInstance.callWithTamperedToken();
    const text = await settle(fixture);
    expect(withTamperedToken).toHaveBeenCalledWith('h.p.sig');
    expect(text.match(/\(token alterado\)/g)).toHaveLength(3);
  });

  it('does not call the API with a tampered token when there is no session', async () => {
    const withTamperedToken = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiClient,
          useValue: {
            workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [])),
            events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
            withTamperedToken,
          },
        },
        { provide: AuthService, useValue: { session: signal(null) } },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance.callWithTamperedToken();
    expect(withTamperedToken).not.toHaveBeenCalled();
  });

  it('shows the JSON body of each route, including the error body', async () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [order])),
      events: vi.fn().mockResolvedValue(result<AuditEvent[]>('GET /api/events', 403, null, 'Permisos insuficientes')),
    });
    const text = await settle(fixture);
    expect(text).toContain('"licensePlate": "AA11"');
    expect(text).toContain('"message": "Permisos insuficientes"');
  });

  it('says so when a response has no body', () => {
    const fixture = createDashboard({
      workOrders: vi.fn().mockResolvedValue(result('GET /api/work-orders', 200, [])),
      events: vi.fn().mockResolvedValue(result('GET /api/events', 200, [])),
    });
    expect(fixture.componentInstance.bodyText({ ...result('GET /x', 204), body: null })).toBe('Sin cuerpo en la respuesta');
  });
});
