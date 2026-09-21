import { AccessRequest, ApiResult, WorkOrder } from '../api/api.models';

/** Una cotizacion de taller completa, como la devuelve el servicio. Al mediodia para no depender de la zona horaria. */
export function makeQuote(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'OT-2026-000101',
    clientId: 'CLI-0142',
    licensePlate: 'KLXP42',
    description: 'Mantención de 30.000 km',
    total: 91_400,
    itemCount: 2,
    calculatedSubtotal: 91_400,
    createdAt: '2026-09-21T15:00:00Z',
    createdBy: 'Camila Rojas',
    items: [
      { concept: 'Aceite motor 5W-30 sintético (litros)', quantity: 4, unitPrice: 9_500, subtotal: 38_000 },
      { concept: 'Mano de obra mantención (horas)', quantity: 1.5, unitPrice: 22_000, subtotal: 33_000 },
    ],
    ...overrides,
  };
}

export function makeAccess(status: AccessRequest['status'], overrides: Partial<AccessRequest> = {}): AccessRequest {
  const none = status === 'NONE';
  return {
    id: none ? null : 7,
    userId: none ? null : 'user-7',
    userName: none ? null : 'Camila Rojas',
    userEmail: none ? null : 'camila.rojas@ejemplo.cl',
    status,
    requestedAt: none ? null : '2026-09-21T15:00:00Z',
    decidedAt: status === 'APPROVED' || status === 'REJECTED' ? '2026-09-21T16:00:00Z' : null,
    decidedBy: status === 'APPROVED' || status === 'REJECTED' ? 'Admin Taller' : null,
    ...overrides,
  };
}

/** Resultado de una llamada al API; `body` toma por defecto los datos o, en un error, un cuerpo {status,error,message}. */
export function makeResult<T>(
  route: string,
  status: number,
  data: T | null = null,
  options: { message?: string | null; error?: string } = {},
): ApiResult<T> {
  const ok = status >= 200 && status < 400;
  const message = options.message ?? null;
  const body = ok ? data : { status, error: options.error ?? 'error', message: message ?? 'error' };
  return { route, status, ok, data: ok ? data : null, message, body };
}
