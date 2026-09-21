import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { withTamperedSignature } from '../auth/jwt';
import { ApiLog } from './api-log';
import { AccessDecision, AccessRequest, ApiResult, AuditEvent, CreateOrderRequest, WorkOrder } from './api.models';

const WORK_ORDERS_URL = `${environment.apiBaseUrl}/api/work-orders`;
const EVENTS_URL = `${environment.apiBaseUrl}/api/events`;
const ACCESS_URL = `${environment.apiBaseUrl}/api/access-requests`;

/**
 * Cotizacion de ejemplo de un taller: la carga el enlace "Usar datos de ejemplo" del formulario y la usan las
 * pruebas de seguridad (sin token, token alterado). Cumple los limites de CreateWorkOrderRequest del servicio.
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
  if (error.status === 0) return 'No hay conexión con el servidor.';
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return error.statusText || `Error ${error.status}`;
}

/**
 * Cliente de las rutas del API. Nunca lanza por un estado HTTP de error: devuelve el codigo para poder mostrar
 * 200/201/401/403 tal cual (evidencia de que API Gateway y el BFF validan el JWT). Cada resultado tambien queda en
 * {@link ApiLog}, que alimenta la pagina de Diagnostico.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly log = inject(ApiLog);
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

  /** Estado de la solicitud del usuario actual (NONE si nunca pidio acceso). */
  accessMine(): Promise<ApiResult<AccessRequest>> {
    return this.call('GET /api/access-requests/me', this.http.get<AccessRequest>(`${ACCESS_URL}/me`, { observe: 'response' }));
  }

  /** El usuario actual pide acceso; la identidad la toma el servidor del token, no del cuerpo. */
  requestAccess(): Promise<ApiResult<AccessRequest>> {
    return this.call('POST /api/access-requests', this.http.post<AccessRequest>(ACCESS_URL, {}, { observe: 'response' }));
  }

  /** Solo el administrador: todas las solicitudes, las pendientes primero. */
  accessRequests(): Promise<ApiResult<AccessRequest[]>> {
    return this.call('GET /api/access-requests', this.http.get<AccessRequest[]>(ACCESS_URL, { observe: 'response' }));
  }

  /** Solo el administrador: aprueba o rechaza (rechazar una aprobada equivale a revocar). */
  decideAccess(id: number, decision: AccessDecision): Promise<ApiResult<AccessRequest>> {
    return this.call(
      'POST /api/access-requests/decision',
      this.http.post<AccessRequest>(`${ACCESS_URL}/decision`, { id, decision }, { observe: 'response' }),
    );
  }

  /** Todas las rutas sin Authorization: API Gateway (o el BFF en local) debe responder 401 en cada una. */
  withoutToken(): Promise<ApiResult<unknown>[]> {
    return this.probeRoutes('sin token', new HttpHeaders());
  }

  /** Todas las rutas con un token real pero de firma alterada: el 401 demuestra que se verifica la firma. */
  withTamperedToken(token: string): Promise<ApiResult<unknown>[]> {
    return this.probeRoutes('token alterado', new HttpHeaders({ Authorization: `Bearer ${withTamperedSignature(token)}` }));
  }

  /**
   * Prueba las siete rutas por fuera de los interceptores. Con un token invalido o ausente ninguna llega al BFF,
   * asi que ni el POST de cotizacion ni la decision (id inexistente) pueden dejar datos.
   */
  private probeRoutes(note: string, headers: HttpHeaders): Promise<ApiResult<unknown>[]> {
    const options = { observe: 'response' as const, headers };
    const raw = this.withoutInterceptors;
    return Promise.all([
      this.call(`GET /api/work-orders (${note})`, raw.get<WorkOrder[]>(WORK_ORDERS_URL, options)),
      this.call(`GET /api/events (${note})`, raw.get<AuditEvent[]>(EVENTS_URL, options)),
      this.call(`POST /api/work-orders (${note})`, raw.post<WorkOrder>(WORK_ORDERS_URL, SAMPLE_ORDER, options)),
      this.call(`GET /api/access-requests/me (${note})`, raw.get<AccessRequest>(`${ACCESS_URL}/me`, options)),
      this.call(`POST /api/access-requests (${note})`, raw.post<AccessRequest>(ACCESS_URL, {}, options)),
      this.call(`GET /api/access-requests (${note})`, raw.get<AccessRequest[]>(ACCESS_URL, options)),
      this.call(
        `POST /api/access-requests/decision (${note})`,
        raw.post<AccessRequest>(`${ACCESS_URL}/decision`, { id: 0, decision: 'REJECTED' }, options),
      ),
    ]);
  }

  private async call<T>(route: string, request: Observable<HttpResponse<T>>): Promise<ApiResult<T>> {
    let result: ApiResult<T>;
    try {
      const response = await firstValueFrom(request);
      result = { route, status: response.status, ok: true, data: response.body, message: null, body: response.body };
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) throw error;
      result = { route, status: error.status, ok: false, data: null, message: messageFrom(error), body: error.error };
    }
    this.log.record(result);
    return result;
  }
}
