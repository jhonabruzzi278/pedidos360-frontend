import { HttpHeaders, HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ApiClient, SAMPLE_ORDER } from './api-client';
import { ApiLog } from './api-log';

const base = environment.apiBaseUrl;
const ROUTES = [
  ['GET', '/api/work-orders'],
  ['GET', '/api/events'],
  ['POST', '/api/work-orders'],
  ['GET', '/api/access-requests/me'],
  ['POST', '/api/access-requests'],
  ['GET', '/api/access-requests'],
  ['POST', '/api/access-requests/decision'],
] as const;

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

  it('keeps the raw body of a successful and of a failed response', async () => {
    const ok = client.workOrders();
    http.expectOne(`${base}/api/work-orders`).flush([{ id: 'OT-1' }], { status: 200, statusText: 'OK' });
    expect((await ok).body).toEqual([{ id: 'OT-1' }]);

    const denied = client.events();
    http.expectOne(`${base}/api/events`).flush({ status: 403, message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect((await denied).body).toEqual({ status: 403, message: 'Forbidden' });
  });

  describe('access requests', () => {
    it('asks for the state of the current user', async () => {
      const pending = client.accessMine();
      const request = http.expectOne(`${base}/api/access-requests/me`);
      expect(request.request.method).toBe('GET');
      request.flush({ status: 'PENDING' }, { status: 200, statusText: 'OK' });
      expect(await pending).toMatchObject({ route: 'GET /api/access-requests/me', ok: true, data: { status: 'PENDING' } });
    });

    it('requests access without sending an identity: the server takes it from the token', async () => {
      const pending = client.requestAccess();
      const request = http.expectOne(`${base}/api/access-requests`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({});
      request.flush({ status: 'PENDING' }, { status: 200, statusText: 'OK' });
      expect(await pending).toMatchObject({ route: 'POST /api/access-requests', ok: true });
    });

    it('lists the requests for the administrator', async () => {
      const pending = client.accessRequests();
      http.expectOne(`${base}/api/access-requests`).flush([{ id: 1 }], { status: 200, statusText: 'OK' });
      expect(await pending).toMatchObject({ route: 'GET /api/access-requests', ok: true, data: [{ id: 1 }] });
    });

    it('sends the decision with the id of the request', async () => {
      const pending = client.decideAccess(7, 'APPROVED');
      const request = http.expectOne(`${base}/api/access-requests/decision`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ id: 7, decision: 'APPROVED' });
      request.flush({ status: 'APPROVED' }, { status: 200, statusText: 'OK' });
      expect(await pending).toMatchObject({ route: 'POST /api/access-requests/decision', ok: true });
    });

    it('reports a refusal to a user who is not an administrator', async () => {
      const pending = client.accessRequests();
      http.expectOne(`${base}/api/access-requests`)
        .flush({ status: 403, error: 'forbidden', message: 'Permisos insuficientes' }, { status: 403, statusText: 'Forbidden' });
      expect(await pending).toMatchObject({ status: 403, ok: false, message: 'Permisos insuficientes' });
    });
  });
});

describe('ApiClient security probes', () => {
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

  function respondAll(status: number, check: (request: HttpRequest<unknown>) => void): void {
    for (const [method, path] of ROUTES) {
      const testRequest = http.expectOne((r) => r.method === method && r.url === `${base}${path}`);
      check(testRequest.request);
      testRequest.flush({ message: 'Unauthorized' }, { status, statusText: 'Unauthorized' });
    }
  }

  it('tests all seven routes without any interceptor when checking without a token', async () => {
    const pending = client.withoutToken();
    respondAll(401, (request) => expect(request.headers.has('Authorization')).toBe(false));
    const results = await pending;

    expect(results.map((r) => r.route)).toEqual(ROUTES.map(([method, path]) => `${method} ${path} (sin token)`));
    expect(results.every((r) => r.status === 401 && !r.ok)).toBe(true);
    expect(seenAuthorization).toEqual([]);
  });

  it('tests all seven routes with the signature of the token altered', async () => {
    const pending = client.withTamperedToken('cabecera.datos.Firma');
    respondAll(401, (request) => expect(request.headers.get('Authorization')).toBe('Bearer cabecera.datos.Airma'));
    const results = await pending;

    expect(results).toHaveLength(7);
    expect(results.map((r) => r.route)).toContain('POST /api/access-requests/decision (token alterado)');
    expect(results.every((r) => r.status === 401)).toBe(true);
    expect(seenAuthorization).toEqual([]);
  });

  it('probes the decision with an id that does not exist so it can never change anything', async () => {
    const pending = client.withoutToken();
    let body: unknown;
    respondAll(401, (request) => {
      if (request.url.endsWith('/decision')) body = request.body;
    });
    await pending;
    expect(body).toEqual({ id: 0, decision: 'REJECTED' });
  });
});

describe('ApiClient log', () => {
  it('leaves every result in the API log for the diagnostics page', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const client = TestBed.inject(ApiClient);
    const http = TestBed.inject(HttpTestingController);
    const log = TestBed.inject(ApiLog);

    const first = client.workOrders();
    http.expectOne(`${base}/api/work-orders`).flush([], { status: 200, statusText: 'OK' });
    await first;
    const second = client.createOrder(SAMPLE_ORDER);
    http.expectOne(`${base}/api/work-orders`).flush({ status: 403, error: 'access_required' }, { status: 403, statusText: 'Forbidden' });
    await second;

    expect(log.results().map((r) => `${r.route} ${r.status}`)).toEqual(['GET /api/work-orders 200', 'POST /api/work-orders 403']);
    http.verify();
  });
});
