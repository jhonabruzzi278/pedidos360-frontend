import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ApiClient } from './api-client';

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

  it('creates the sample order with POST', async () => {
    const pending = client.createSampleOrder();
    const request = http.expectOne(`${base}/api/work-orders`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.items.length).toBeGreaterThan(0);
    request.flush({ id: 'OT-2' }, { status: 201, statusText: 'Created' });
    expect(await pending).toMatchObject({ route: 'POST /api/work-orders', status: 201, ok: true });
  });

  it('sends the request without any interceptor when checking without a token', async () => {
    const pending = client.workOrdersWithoutToken();
    const request = http.expectOne(`${base}/api/work-orders`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(await pending).toMatchObject({ route: 'GET /api/work-orders (sin token)', status: 401, ok: false });
    expect(seenAuthorization).toEqual([]);
  });
});
