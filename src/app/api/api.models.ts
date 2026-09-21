export interface QuoteItem {
  concept: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Una cotizacion (en el servicio es una orden de trabajo: por eso la ruta sigue siendo /api/work-orders). */
export interface WorkOrder {
  id: string;
  clientId: string;
  licensePlate: string;
  description: string;
  total: number;
  itemCount: number;
  calculatedSubtotal: number;
  createdAt: string;
  /** Quien la emitio; nulo en las cotizaciones anteriores a este dato. */
  createdBy: string | null;
  items: QuoteItem[];
}

export interface AuditEvent {
  id: number;
  workOrderId: string;
  eventType: string;
  createdAt: string;
}

/** Cuerpo del POST /api/work-orders. Los limites son los de CreateWorkOrderRequest en el microservicio. */
export interface CreateOrderRequest {
  readonly clientId: string;
  readonly licensePlate: string;
  readonly description: string;
  readonly items: readonly OrderItemInput[];
}

export interface OrderItemInput {
  readonly concept: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

/** NONE: el usuario nunca pidio acceso. */
export type AccessStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AccessDecision = 'APPROVED' | 'REJECTED';

/** Solicitud de acceso para generar cotizaciones. Con estado NONE el resto de los campos viene nulo. */
export interface AccessRequest {
  id: number | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  status: AccessStatus;
  requestedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface ApiResult<T> {
  readonly route: string;
  readonly status: number;
  readonly ok: boolean;
  readonly data: T | null;
  readonly message: string | null;
  /** Cuerpo JSON tal como llego (tambien en errores): es la evidencia de lo que respondio el API. */
  readonly body: unknown;
}

/** Codigo de error del cuerpo de una respuesta fallida ({status, error, message}), si lo trae. */
export function errorCode(result: ApiResult<unknown>): string | null {
  const body = result.body;
  if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return null;
}

/** El BFF responde 403 con este codigo cuando falta la autorizacion del administrador para cotizar. */
export const ACCESS_REQUIRED = 'access_required';

const clpFormat = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** Pesos chilenos sin decimales, con punto de miles: $91.400. */
export function formatClp(value: number): string {
  return clpFormat.format(value);
}

/** Texto corto del codigo HTTP para la interfaz. */
export function statusLabel(status: number): string {
  switch (status) {
    case 200:
      return 'OK';
    case 201:
      return 'Creado';
    case 401:
      return 'No autenticado';
    case 403:
      return 'Sin permiso';
    case 0:
      return 'Sin conexión';
    default:
      return `Error ${status}`;
  }
}
