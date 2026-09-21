import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ApiClient, SAMPLE_ORDER } from './api-client';

const base = environment.apiBaseUrl;

describe('ApiClient', () => {
  let client: ApiClient;
  let http: HttpTestingController;
  const seenAuthorization: (string | null)[] = [];

  beforeEach(() => {
    seenAuthorization.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            (request, next) => {
              seenAuthorization.push(request.headers.get('Authorization'));
              return next(request.clone({ headers: new HttpHeaders({ Authorization: 'Bearer con-token' }) }));
            },
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns status and body for a successful GET', async () => {
    const pending = client.workOrders();
    http.expectOne(`${base}/api/work-orders`).flush([{ id: 'OT-1' }], { status: 200, statusText: 'OK' });
    const result = await pending;
    expect(result).toMatchObject({ route: 'GET /api/work-orders', status: 200, ok: true, message: null });
    expect(result.data).toEqual([{ id: 'OT-1' }]);
  });

  it('reads the events route', async () => {
    const pending = client.events();
    http.expectOne(`${base}/api/events`).flush([], { status: 200, statusText: 'OK' });
    expect(await pending).toMatchObject({ route: 'GET /api/events', status: 200, ok: true });
  });

  it.each([
    [401, { status: 401, error: 'unauthorized', message: 'Token invalido' }, 'Token invalido'],
    [403, { message: 'Forbidden' }, 'Forbidden'],
  ])('reports status %i with the message of the API', async (status, body, message) => {
    const pending = client.workOrders();
    http.expectOne(`${base}/api/work-orders`).flush(body, { status, statusText: 'x' });
    expect(await pending).toMatchObject({ status, ok: false, data: null, message });
  });

  it('reports status 0 when the API cannot be reached', async () => {
    const pending = client.events();
    http.expectOne(`${base}/api/events`).error(new ProgressEvent('error'));
    const result = await pending;
    expect(result.status).toBe(0);
    expect(result.message).toContain('No hay conexión');
  });

  it('creates an order with POST and sends exactly the data of the form', async () => {
    const order = {
      clientId: 'CLI-0142',
      licensePlate: 'KLXP42',
      description: 'Mantención',
      items: [{ concept: 'Filtro de aceite', quantity: 1, unitPrice: 7900 }],
    };
    const pending = client.createOrder(order);
    const request = http.expectOne(`${base}/api/work-orders`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(order);
    request.flush({ id: 'OT-2' }, { status: 201, statusText: 'Created' });
    expect(await pending).toMatchObject({ route: 'POST /api/work-orders', status: 201, ok: true });
  });

  it('uses a sample order that respects the limits of the microservice', () => {
    expect(SAMPLE_ORDER.clientId.length).toBeLessThanOrEqual(20);
    expect(SAMPLE_ORDER.licensePlate.length).toBeLessThanOrEqual(10);
    expect(SAMPLE_ORDER.description.length).toBeLessThanOrEqual(200);
    expect(SAMPLE_ORDER.items.length).toBeGreaterThan(0);
    for (const item of SAMPLE_ORDER.items) {
      expect(item.concept.length).toBeLessThanOrEqual(40);
      expect(item.quantity).toBeGreaterThan(0);
      expect(Number.isInteger(item.unitPrice)).toBe(true);
    }
  });

  it('sends the three routes without any interceptor when checking without a token', async () => {
    const pending = client.withoutToken();
    const requests = [
      http.expectOne((r) => r.method === 'GET' && r.url === `${base}/api/work-orders`),
      http.expectOne((r) => r.method === 'GET' && r.url === `${base}/api/events`),
      http.expectOne((r) => r.method === 'POST' && r.url === `${base}/api/work-orders`),
    ];
    for (const request of requests) {
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    }
    const results = await pending;
    expect(results.map((r) => r.route)).toEqual([
      'GET /api/work-orders (sin token)',
      'GET /api/events (sin token)',
      'POST /api/work-orders (sin token)',
    ]);
    expect(results.every((r) => r.status === 401 && !r.ok)).toBe(true);
    expect(seenAuthorization).toEqual([]);
  });

  it('sends the three routes with the signature of the token altered', async () => {
    const pending = client.withTamperedToken('cabecera.datos.Firma');
    const requests = [
      http.expectOne((r) => r.method === 'GET' && r.url === `${base}/api/work-orders`),
      http.expectOne((r) => r.method === 'GET' && r.url === `${base}/api/events`),
      http.expectOne((r) => r.method === 'POST' && r.url === `${base}/api/work-orders`),
    ];
    for (const request of requests) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer cabecera.datos.Airma');
      request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    }
    const results = await pending;
    expect(results.map((r) => r.route)).toContain('POST /api/work-orders (token alterado)');
    expect(results.every((r) => r.status === 401)).toBe(true);
    expect(seenAuthorization).toEqual([]);
  });

  it('keeps the raw body of a successful and of a failed response', async () => {
    const ok = client.workOrders();
    http.expectOne(`${base}/api/work-orders`).flush([{ id: 'OT-1' }], { status: 200, statusText: 'OK' });
    expect((await ok).body).toEqual([{ id: 'OT-1' }]);

    const denied = client.events();
    http.expectOne(`${base}/api/events`).flush({ status: 403, message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect((await denied).body).toEqual({ status: 403, message: 'Forbidden' });
  });
});
