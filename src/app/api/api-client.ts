import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { withTamperedSignature } from '../auth/jwt';
import { AuditEvent, ApiResult, CreateOrderRequest, WorkOrder } from './api.models';

const WORK_ORDERS_URL = `${environment.apiBaseUrl}/api/work-orders`;
const EVENTS_URL = `${environment.apiBaseUrl}/api/events`;

/**
 * Orden de ejemplo de un taller: la carga el boton "Cargar ejemplo" del formulario y la usan las pruebas de
 * seguridad (sin token, token alterado). Cumple los limites de CreateWorkOrderRequest del microservicio.
 */
export const SAMPLE_ORDER: CreateOrderRequest = {
  clientId: 'CLI-0158',
  licensePlate: 'JKLM45',
  description: 'Cambio de pastillas de freno delanteras y revisión de discos',
  items: [
    { concept: 'Pastillas de freno delanteras', quantity: 1, unitPrice: 48900 },
    { concept: 'Mano de obra frenos (horas)', quantity: 1.5, unitPrice: 22000 },
  ],
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

  createOrder(order: CreateOrderRequest): Promise<ApiResult<WorkOrder>> {
    return this.call('POST /api/work-orders', this.http.post<WorkOrder>(WORK_ORDERS_URL, order, { observe: 'response' }));
  }

  /** Las tres rutas sin Authorization: API Gateway (o el BFF en local) debe responder 401 en todas. */
  withoutToken(): Promise<ApiResult<unknown>[]> {
    return this.probeRoutes('sin token', new HttpHeaders());
  }

  /** Las tres rutas con un token real pero de firma alterada: el 401 demuestra que se verifica la firma. */
  withTamperedToken(token: string): Promise<ApiResult<unknown>[]> {
    return this.probeRoutes('token alterado', new HttpHeaders({ Authorization: `Bearer ${withTamperedSignature(token)}` }));
  }

  private probeRoutes(note: string, headers: HttpHeaders): Promise<ApiResult<unknown>[]> {
    const options = { observe: 'response' as const, headers };
    return Promise.all([
      this.call(`GET /api/work-orders (${note})`, this.withoutInterceptors.get<WorkOrder[]>(WORK_ORDERS_URL, options)),
      this.call(`GET /api/events (${note})`, this.withoutInterceptors.get<AuditEvent[]>(EVENTS_URL, options)),
      this.call(`POST /api/work-orders (${note})`, this.withoutInterceptors.post<WorkOrder>(WORK_ORDERS_URL, SAMPLE_ORDER, options)),
    ]);
  }

  private async call<T>(route: string, request: Observable<HttpResponse<T>>): Promise<ApiResult<T>> {
    try {
      const response = await firstValueFrom(request);
      return { route, status: response.status, ok: true, data: response.body, message: null, body: response.body };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        return { route, status: error.status, ok: false, data: null, message: messageFrom(error), body: error.error };
      }
      throw error;
    }
  }
}
