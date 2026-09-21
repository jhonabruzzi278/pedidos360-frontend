export interface WorkOrder {
  id: string;
  clientId: string;
  licensePlate: string;
  description: string;
  total: number;
  itemCount: number;
  calculatedSubtotal: number;
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

export interface ApiResult<T> {
  readonly route: string;
  readonly status: number;
  readonly ok: boolean;
  readonly data: T | null;
  readonly message: string | null;
  /** Cuerpo JSON tal como llego (tambien en errores): es la evidencia de lo que respondio el API. */
  readonly body: unknown;
}

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
