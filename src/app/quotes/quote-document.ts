import { WorkOrder, formatClp } from '../api/api.models';

/** Datos que muestran por igual la vista previa y el PDF: se calculan una sola vez, aqui. */
export const VALIDITY_DAYS = 15;
/** Los precios de la cotizacion llevan IVA incluido; el IVA (19 %) se informa, no se suma. */
export const VAT_RATE = 0.19;
export const COMPANY = { name: 'Taller Pedidos360', tagline: 'Mecánica y mantención de vehículos' } as const;
/** Para las cotizaciones anteriores a que se guardara quien las emitio. */
export const DEFAULT_ISSUER = 'Equipo del taller';

export interface QuoteLine {
  readonly concept: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly subtotal: string;
}

export interface QuoteDocument {
  readonly number: string;
  readonly issuedOn: string;
  readonly validUntil: string;
  readonly validityDays: number;
  readonly issuedBy: string;
  readonly clientId: string;
  readonly licensePlate: string;
  readonly description: string;
  readonly lines: readonly QuoteLine[];
  readonly total: string;
  readonly vatIncluded: string;
}

const dateFormat = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const quantityFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** El servicio numera con prefijo de "orden de trabajo" (OT-2026-000101); la cotizacion se muestra como 2026-000101. */
export function quoteNumber(id: string): string {
  return id.replace(/^OT-/, '');
}

export function quoteFileName(quote: WorkOrder): string {
  return `cotizacion-${quoteNumber(quote.id)}.pdf`;
}

/** IVA contenido en un precio final: total - total / 1,19, redondeado a pesos enteros. */
export function vatIncluded(total: number): number {
  return Math.round(total - total / (1 + VAT_RATE));
}

function formatDate(value: Date): string {
  return Number.isNaN(value.getTime()) ? '—' : dateFormat.format(value);
}

export function buildQuoteDocument(quote: WorkOrder): QuoteDocument {
  const issued = new Date(quote.createdAt);
  const validUntil = new Date(issued);
  validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS);
  return {
    number: quoteNumber(quote.id),
    issuedOn: formatDate(issued),
    validUntil: formatDate(validUntil),
    validityDays: VALIDITY_DAYS,
    issuedBy: quote.createdBy?.trim() || DEFAULT_ISSUER,
    clientId: quote.clientId,
    licensePlate: quote.licensePlate,
    description: quote.description ?? '',
    lines: quote.items.map((item) => ({
      concept: item.concept,
      quantity: quantityFormat.format(item.quantity),
      unitPrice: formatClp(item.unitPrice),
      subtotal: formatClp(item.subtotal),
    })),
    total: formatClp(quote.total),
    vatIncluded: formatClp(vatIncluded(quote.total)),
  };
}
