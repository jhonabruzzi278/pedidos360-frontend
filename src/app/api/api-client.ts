import { HttpBackend, HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuditEvent, ApiResult, WorkOrder } from './api.models';

const WORK_ORDERS_URL = `${environment.apiBaseUrl}/api/work-orders`;
const EVENTS_URL = `${environment.apiBaseUrl}/api/events`;

/** Cuerpo del POST de la prueba: cumple los limites de CreateWorkOrderRequest del microservicio. */
const SAMPLE_ORDER = {
  clientId: 'CLI-DEMO',
  licensePlate: 'AB1234',
  description: 'Orden de prueba creada desde el frontend',
  items: [{ concept: 'Cambio de aceite', quantity: 1, unitPrice: 25000 }],
};

function messageFrom(error: HttpErrorResponse): string {
  if (error.status === 0) return 'No hay conexión con el API.';
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return error.statusText || `Error ${error.status}`;
}

/**
 * Cliente de las tres rutas del API. Nunca lanza por un estado HTTP de error: devuelve el codigo para
 * poder mostrar 200/201/401/403 tal cual (evidencia de que API Gateway y el BFF validan el JWT).
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  /** Cliente que se salta los interceptores: la llamada sale sin Authorization. */
  private readonly withoutInterceptors = new HttpClient(inject(HttpBackend));

  workOrders(): Promise<ApiResult<WorkOrder[]>> {
    return this.call('GET /api/work-orders', this.http.get<WorkOrder[]>(WORK_ORDERS_URL, { observe: 'response' }));
  }

  events(): Promise<ApiResult<AuditEvent[]>> {
    return this.call('GET /api/events', this.http.get<AuditEvent[]>(EVENTS_URL, { observe: 'response' }));
  }

  createSampleOrder(): Promise<ApiResult<WorkOrder>> {
    return this.call('POST /api/work-orders', this.http.post<WorkOrder>(WORK_ORDERS_URL, SAMPLE_ORDER, { observe: 'response' }));
  }

  workOrdersWithoutToken(): Promise<ApiResult<WorkOrder[]>> {
    return this.call(
      'GET /api/work-orders (sin token)',
      this.withoutInterceptors.get<WorkOrder[]>(WORK_ORDERS_URL, { observe: 'response' }),
    );
  }

  private async call<T>(route: string, request: Observable<HttpResponse<T>>): Promise<ApiResult<T>> {
    try {
      const response = await firstValueFrom(request);
      return { route, status: response.status, ok: true, data: response.body, message: null };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        return { route, status: error.status, ok: false, data: null, message: messageFrom(error) };
      }
      throw error;
    }
  }
}
