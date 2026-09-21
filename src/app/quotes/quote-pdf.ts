import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { WorkOrder } from '../api/api.models';
import { COMPANY, QuoteDocument, buildQuoteDocument, quoteFileName } from './quote-document';

const MARGIN = 18;
const PAGE_WIDTH = 210;
const PAGE_BOTTOM = 270;
const ACCENT: [number, number, number] = [18, 107, 82];
const MUTED: [number, number, number] = [95, 109, 103];
const INK: [number, number, number] = [29, 41, 37];

type AutoTable = (doc: jsPDF, options: Record<string, unknown>) => void;

/**
 * Arma el PDF de una cotizacion. jsPDF y jsPDF-AutoTable pesan bastante y solo hacen falta al descargar: se cargan
 * bajo demanda para que no engorden el bundle inicial de la aplicacion.
 */
export async function buildQuotePdf(quote: WorkOrder): Promise<jsPDF> {
  const document = buildQuoteDocument(quote);
  const [{ jsPDF: PdfDocument }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default as unknown as AutoTable;

  const pdf = new PdfDocument({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: `Cotización ${document.number}`, author: COMPANY.name, creator: 'Pedidos360' });

  drawHeader(pdf, document);
  const detailsBottom = drawDetails(pdf, document);
  const tableBottom = drawLines(pdf, autoTable, document, detailsBottom);
  drawTotals(pdf, document, tableBottom);
  drawFooter(pdf, document);
  return pdf;
}

/** Como se entrega el archivo al usuario; por defecto la descarga del navegador (jsPDF crea el enlace y lo pulsa). */
export type PdfSaver = (pdf: jsPDF, fileName: string) => void;
const saveInBrowser: PdfSaver = (pdf, fileName) => pdf.save(fileName);

export async function downloadQuotePdf(quote: WorkOrder, save: PdfSaver = saveInBrowser): Promise<void> {
  const pdf = await buildQuotePdf(quote);
  save(pdf, quoteFileName(quote));
}

/** Punto de inyeccion de la descarga: las pruebas de la vista previa lo reemplazan sin generar un PDF real. */
@Injectable({ providedIn: 'root' })
export class QuotePdf {
  download(quote: WorkOrder): Promise<void> {
    return downloadQuotePdf(quote);
  }
}

function drawHeader(pdf: jsPDF, quote: QuoteDocument): void {
  pdf.setTextColor(...INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(COMPANY.name, MARGIN, 24);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text(COMPANY.tagline, MARGIN, 30);

  pdf.setTextColor(...ACCENT);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('COTIZACIÓN', PAGE_WIDTH - MARGIN, 24, { align: 'right' });
  pdf.setTextColor(...INK);
  pdf.setFontSize(11);
  pdf.text(`N° ${quote.number}`, PAGE_WIDTH - MARGIN, 31, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text(`Emitida el ${quote.issuedOn}`, PAGE_WIDTH - MARGIN, 36, { align: 'right' });

  pdf.setDrawColor(...ACCENT);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN, 41, PAGE_WIDTH - MARGIN, 41);
}

/** Cliente, vehiculo y validez; devuelve la coordenada Y donde termina el bloque. */
function drawDetails(pdf: jsPDF, quote: QuoteDocument): number {
  const columns: readonly (readonly [string, string])[] = [
    ['CLIENTE', quote.clientId],
    ['VEHÍCULO (PATENTE)', quote.licensePlate],
    ['EMITIDA POR', quote.issuedBy],
    ['VÁLIDA HASTA', quote.validUntil],
  ];
  const width = (PAGE_WIDTH - 2 * MARGIN) / 2;
  columns.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * width;
    const y = 50 + Math.floor(index / 2) * 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(label, x, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text(value, x, y + 5.5, { maxWidth: width - 4 });
  });

  let bottom = 50 + 14 + 8;
  if (quote.description.trim() !== '') {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text('TRABAJO A REALIZAR', MARGIN, bottom + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...INK);
    const lines = pdf.splitTextToSize(quote.description, PAGE_WIDTH - 2 * MARGIN) as string[];
    pdf.text(lines, MARGIN, bottom + 12);
    bottom += 12 + lines.length * 5;
  }
  return bottom + 4;
}

function drawLines(pdf: jsPDF, autoTable: AutoTable, quote: QuoteDocument, startY: number): number {
  autoTable(pdf, {
    startY,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Concepto', 'Cantidad', 'Precio unitario', 'Subtotal']],
    body: quote.lines.map((line) => [line.concept, line.quantity, line.unitPrice, line.subtotal]),
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.6, textColor: INK },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 241, 234] },
    columnStyles: {
      1: { halign: 'right', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 36 },
    },
  });
  const finalY = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return finalY ?? startY + 12 + quote.lines.length * 9;
}

function drawTotals(pdf: jsPDF, quote: QuoteDocument, tableBottom: number): void {
  let y = tableBottom + 10;
  if (y > PAGE_BOTTOM - 24) {
    pdf.addPage();
    y = MARGIN + 6;
  }
  const right = PAGE_WIDTH - MARGIN;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...MUTED);
  pdf.text(`IVA incluido (19 %): ${quote.vatIncluded}`, right, y, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(...ACCENT);
  pdf.text(`Total: ${quote.total}`, right, y + 9, { align: 'right' });
}

function drawFooter(pdf: jsPDF, quote: QuoteDocument): void {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(...MUTED);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, 280, PAGE_WIDTH - MARGIN, 280);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(
      `Cotización válida por ${quote.validityDays} días. Valores en pesos chilenos (CLP), IVA incluido.`,
      MARGIN,
      285,
    );
    pdf.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN, 285, { align: 'right' });
  }
}
