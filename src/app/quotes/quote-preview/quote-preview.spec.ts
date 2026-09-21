import { TestBed } from '@angular/core/testing';
import { WorkOrder } from '../../api/api.models';
import { makeQuote } from '../../testing/quote-fixtures';
import { QuotePdf } from '../quote-pdf';
import { QuotePreview } from './quote-preview';

function createPreview(quote: WorkOrder = makeQuote(), download = vi.fn().mockResolvedValue(undefined)) {
  TestBed.configureTestingModule({ providers: [{ provide: QuotePdf, useValue: { download } }] });
  const fixture = TestBed.createComponent(QuotePreview);
  fixture.componentRef.setInput('quote', quote);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(label));
  return { fixture, element, download, text: () => element.textContent ?? '', button };
}

describe('QuotePreview', () => {
  it('shows the quote as a document: number, date, who issued it, client and vehicle', () => {
    const { text } = createPreview();
    expect(text()).toContain('Cotización N° 2026-000101');
    expect(text()).toContain('Taller Pedidos360');
    expect(text()).toContain('Emitida el 21-09-2026');
    expect(text()).toContain('Camila Rojas');
    expect(text()).toContain('CLI-0142');
    expect(text()).toContain('KLXP42');
    expect(text()).toContain('Mantención de 30.000 km');
  });

  it('lists every item with its quantity, unit price and subtotal', () => {
    const { element } = createPreview();
    const rows = Array.from(element.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? ''),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('Aceite motor 5W-30 sintético (litros)');
    expect(rows[0][1]).toBe('4');
    expect(rows[0][2]).toMatch(/^\$\s?9\.500$/);
    expect(rows[0][3]).toMatch(/^\$\s?38\.000$/);
    expect(rows[1][0]).toBe('Mano de obra mantención (horas)');
    expect(rows[1][1]).toBe('1,5');
    expect(rows[1][3]).toMatch(/^\$\s?33\.000$/);
  });

  it('shows the total, the VAT it includes and the validity', () => {
    const { text } = createPreview();
    expect(text()).toMatch(/Total: \$\s?91\.400/);
    expect(text()).toMatch(/IVA incluido \(19 %\): \$\s?14\.593/);
    expect(text()).toContain('Válida hasta');
    expect(text()).toContain('06-10-2026');
    expect(text()).toContain('válida por 15 días');
  });

  it('leaves out the work section for a quote without description', () => {
    expect(createPreview(makeQuote({ description: '' })).text()).not.toContain('Trabajo a realizar');
  });

  it('downloads the PDF of that quote', async () => {
    const quote = makeQuote({ id: 'OT-2026-000105' });
    const { button, download, fixture } = createPreview(quote);

    button('Descargar PDF')?.click();
    await fixture.whenStable();

    expect(download).toHaveBeenCalledWith(quote);
  });

  it('disables the button and says so while the PDF is being prepared', async () => {
    let finish: () => void = () => undefined;
    const download = vi.fn().mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { fixture, button } = createPreview(makeQuote(), download);

    const pending = fixture.componentInstance.download();
    fixture.detectChanges();
    expect(button('Preparando PDF')?.disabled).toBe(true);

    finish();
    await pending;
    fixture.detectChanges();
    expect(button('Descargar PDF')?.disabled).toBe(false);
  });

  it('shows an error when the PDF cannot be generated and lets the user try again', async () => {
    const download = vi.fn().mockRejectedValueOnce(new Error('falló')).mockResolvedValueOnce(undefined);
    const { fixture, element } = createPreview(makeQuote(), download);

    await fixture.componentInstance.download();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No se pudo generar el PDF');

    await fixture.componentInstance.download();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('emits when it is closed', () => {
    const { fixture, button } = createPreview();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    button('Cerrar')?.click();
    expect(closed).toHaveBeenCalledOnce();
  });
});
