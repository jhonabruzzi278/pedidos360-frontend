import { makeQuote } from '../testing/quote-fixtures';
import { buildQuotePdf, downloadQuotePdf } from './quote-pdf';

/** Se genera un PDF de verdad con jsPDF: es la unica forma de comprobar que el documento sale bien armado. */
async function pdfText(quote = makeQuote()): Promise<{ text: string; pages: number; head: string }> {
  const pdf = await buildQuotePdf(quote);
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  return {
    text: new TextDecoder('latin1').decode(bytes),
    pages: pdf.getNumberOfPages(),
    head: new TextDecoder('latin1').decode(bytes.slice(0, 8)),
  };
}

describe('buildQuotePdf', () => {
  it('produces a real PDF document', async () => {
    const { head, pages } = await pdfText();
    expect(head).toMatch(/^%PDF-1\.\d/);
    expect(pages).toBe(1);
  });

  it('prints the number, the client, the plate and the items of the quote', async () => {
    const { text } = await pdfText();
    expect(text).toContain('2026-000101');
    expect(text).toContain('CLI-0142');
    expect(text).toContain('KLXP42');
    expect(text).toContain('Aceite motor 5W-30');
    expect(text).toContain('Camila Rojas');
    expect(text).toContain('21-09-2026');
  });

  it('prints the total with the VAT that it includes', async () => {
    const { text } = await pdfText();
    expect(text).toMatch(/Total: \$\s?91\.400/);
    // Dentro de una cadena PDF los parentesis van escapados con una barra invertida.
    expect(text).toMatch(/IVA incluido \\\(19 %\\\): \$\s?14\.593/);
  });

  it('prints the validity in the footer of every page', async () => {
    const { text } = await pdfText();
    expect(text).toContain('Cotización válida por 15 días'.replace('ó', '\xf3').replace('í', '\xed'));
    expect(text).toContain('gina 1 de 1');
  });

  it('puts a long quote on several pages and numbers them', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ concept: `Repuesto ${i + 1}`, quantity: 1, unitPrice: 1_000, subtotal: 1_000 }));
    const { pages, text } = await pdfText(makeQuote({ items, itemCount: 60, total: 60_000 }));
    expect(pages).toBeGreaterThan(1);
    expect(text).toContain(`gina ${pages} de ${pages}`);
    expect(text).toContain('Repuesto 60');
  });

  it('leaves out the work section when the quote has no description', async () => {
    const { text } = await pdfText(makeQuote({ description: '' }));
    expect(text).not.toContain('TRABAJO A REALIZAR');
  });

  it('sets the title of the document', async () => {
    const { text } = await pdfText();
    expect(text).toContain('/Title (');
    expect(text).toContain('2026-000101');
  });
});

describe('downloadQuotePdf', () => {
  it('hands the finished PDF to the saver under the name of the quote', async () => {
    const save = vi.fn();

    await downloadQuotePdf(makeQuote(), save);

    expect(save).toHaveBeenCalledOnce();
    const [pdf, fileName] = save.mock.calls[0];
    expect(fileName).toBe('cotizacion-2026-000101.pdf');
    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it('saves through the browser by default', async () => {
    // En el navegador jsPDF crea un enlace de descarga; aqui basta con que no falle al generarlo.
    await expect(downloadQuotePdf(makeQuote())).resolves.toBeUndefined();
  });
});
