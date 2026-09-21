import { makeQuote } from '../testing/quote-fixtures';
import {
  DEFAULT_ISSUER, VALIDITY_DAYS, buildQuoteDocument, quoteFileName, quoteNumber, vatIncluded,
} from './quote-document';

describe('quoteNumber', () => {
  it('shows the quote number without the work-order prefix of the service', () => {
    expect(quoteNumber('OT-2026-000101')).toBe('2026-000101');
    expect(quoteNumber('OT-2026-8E50D18A')).toBe('2026-8E50D18A');
  });

  it('leaves an id that has no prefix as it is', () => {
    expect(quoteNumber('2026-000101')).toBe('2026-000101');
  });

  it('names the PDF after the quote', () => {
    expect(quoteFileName(makeQuote())).toBe('cotizacion-2026-000101.pdf');
  });
});

describe('vatIncluded', () => {
  it.each([
    [119_000, 19_000],
    [91_400, 14_593],
    [0, 0],
    [1, 0],
  ])('the VAT contained in %d is %d', (total, vat) => {
    expect(vatIncluded(total)).toBe(vat);
  });
});

describe('buildQuoteDocument', () => {
  it('formats the totals in Chilean pesos and the VAT that they contain', () => {
    const document = buildQuoteDocument(makeQuote({ total: 119_000 }));
    expect(document.total).toMatch(/^\$\s?119\.000$/);
    expect(document.vatIncluded).toMatch(/^\$\s?19\.000$/);
  });

  it('formats each line with its quantity, unit price and subtotal', () => {
    const [oil, labour] = buildQuoteDocument(makeQuote()).lines;
    expect(oil.concept).toBe('Aceite motor 5W-30 sintético (litros)');
    expect(oil.quantity).toBe('4');
    expect(oil.unitPrice).toMatch(/^\$\s?9\.500$/);
    expect(oil.subtotal).toMatch(/^\$\s?38\.000$/);
    expect(labour.quantity).toBe('1,5');
    expect(labour.subtotal).toMatch(/^\$\s?33\.000$/);
  });

  it('dates the quote and makes it valid for 15 days', () => {
    const document = buildQuoteDocument(makeQuote({ createdAt: '2026-09-21T15:00:00Z' }));
    expect(document.issuedOn).toBe('21-09-2026');
    expect(document.validUntil).toBe('06-10-2026');
    expect(document.validityDays).toBe(VALIDITY_DAYS);
  });

  it('carries the validity across the end of a month and of a year', () => {
    expect(buildQuoteDocument(makeQuote({ createdAt: '2026-12-25T15:00:00Z' })).validUntil).toBe('09-01-2027');
  });

  it('shows a dash instead of a broken date', () => {
    const document = buildQuoteDocument(makeQuote({ createdAt: 'no es una fecha' }));
    expect(document.issuedOn).toBe('—');
    expect(document.validUntil).toBe('—');
  });

  it('names who issued the quote, or a default for the old ones', () => {
    expect(buildQuoteDocument(makeQuote()).issuedBy).toBe('Camila Rojas');
    expect(buildQuoteDocument(makeQuote({ createdBy: null })).issuedBy).toBe(DEFAULT_ISSUER);
    expect(buildQuoteDocument(makeQuote({ createdBy: '   ' })).issuedBy).toBe(DEFAULT_ISSUER);
  });

  it('keeps the client, the plate and the description', () => {
    const document = buildQuoteDocument(makeQuote());
    expect(document.number).toBe('2026-000101');
    expect(document.clientId).toBe('CLI-0142');
    expect(document.licensePlate).toBe('KLXP42');
    expect(document.description).toBe('Mantención de 30.000 km');
  });
});
