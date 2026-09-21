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

export interface ApiResult<T> {
  readonly route: string;
  readonly status: number;
  readonly ok: boolean;
  readonly data: T | null;
  readonly message: string | null;
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
