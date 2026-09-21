import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiClient } from '../api/api-client';
import { AccessRequest, WorkOrder } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/session';
import { makeAccess, makeQuote, makeResult } from '../testing/quote-fixtures';
import { QuotePdf } from './quote-pdf';
import { QuotesPage } from './quotes-page';

const older = makeQuote({ id: 'OT-2026-000101', createdAt: '2026-09-20T15:00:00Z', description: 'Mantención de 30.000 km' });
const newer = makeQuote({ id: 'OT-2026-000102', createdAt: '2026-09-21T15:00:00Z', description: 'Frenos', total: 111_900 });

interface Options {
  quotes?: WorkOrder[];
  access?: AccessRequest;
  admin?: boolean;
  api?: Record<string, ReturnType<typeof vi.fn>>;
}

function createPage({ quotes = [older, newer], access = makeAccess('NONE'), admin = false, api = {} }: Options = {}) {
  const client = {
    workOrders: vi.fn().mockResolvedValue(makeResult('GET /api/work-orders', 200, quotes)),
    accessMine: vi.fn().mockResolvedValue(makeResult('GET /api/access-requests/me', 200, access)),
    requestAccess: vi.fn().mockResolvedValue(makeResult('POST /api/access-requests', 200, makeAccess('PENDING'))),
    createOrder: vi.fn(),
    ...api,
  };
  const session = { roles: admin ? ['admin'] : [], scopes: ['orders.read', 'orders.write'] } as unknown as Session;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ApiClient, useValue: client },
      { provide: AuthService, useValue: { session: signal(session) } },
      { provide: QuotePdf, useValue: { download: vi.fn().mockResolvedValue(undefined) } },
    ],
  });
  const fixture = TestBed.createComponent(QuotesPage);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };
  const button = (label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(label));
  return { fixture, element, client, settle, button, text: () => element.textContent ?? '' };
}

describe('QuotesPage', () => {
  it('lists the issued quotes, the newest first, with their number and total in pesos', async () => {
    const { element, settle } = createPage();
    await settle();

    const rows = Array.from(element.querySelectorAll('.table-wrap tbody tr')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('2026-000102');
    expect(rows[0]).toMatch(/\$\s?111\.900/);
    expect(rows[1]).toContain('2026-000101');
    expect(rows[1]).not.toContain('OT-');
  });

  it('shows an empty state when there are no quotes yet', async () => {
    const { text, settle } = createPage({ quotes: [] });
    await settle();
    expect(text()).toContain('Todavía no hay cotizaciones emitidas');
  });

  it('shows an error instead of an empty list when the quotes cannot be loaded', async () => {
    const workOrders = vi.fn().mockResolvedValue(makeResult('GET /api/work-orders', 500, null, { message: 'x' }));
    const { element, settle } = createPage({ api: { workOrders } });
    await settle();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar las cotizaciones');
    expect(element.textContent).not.toContain('Todavía no hay cotizaciones');
  });

  describe('access of the user', () => {
    it('tells a user without access that they cannot quote yet and offers to ask', async () => {
      const { text, button, settle } = createPage({ access: makeAccess('NONE') });
      await settle();
      expect(text()).toContain('Aún no puedes generar cotizaciones');
      expect(button('Solicitar acceso al administrador')).toBeTruthy();
    });

    it('sends the request and then shows it as pending', async () => {
      const { client, button, settle, text } = createPage();
      await settle();

      button('Solicitar acceso al administrador')?.click();
      await settle();

      expect(client.requestAccess).toHaveBeenCalledOnce();
      expect(text()).toContain('Esperando la aprobación del administrador');
    });

    it('lets the user refresh a pending request and picks up the approval', async () => {
      const accessMine = vi.fn()
        .mockResolvedValueOnce(makeResult('GET', 200, makeAccess('PENDING')))
        .mockResolvedValueOnce(makeResult('GET', 200, makeAccess('APPROVED')));
      const { button, settle, text } = createPage({ api: { accessMine } });
      await settle();

      button('Actualizar estado')?.click();
      await settle();

      expect(text()).toContain('Ya puedes generar cotizaciones');
    });

    it('keeps what it knew when the refresh fails', async () => {
      const accessMine = vi.fn()
        .mockResolvedValueOnce(makeResult('GET', 200, makeAccess('PENDING')))
        .mockResolvedValueOnce(makeResult('GET', 500, null, { message: 'x' }));
      const { button, settle, text } = createPage({ api: { accessMine } });
      await settle();

      button('Actualizar estado')?.click();
      await settle();

      expect(text()).toContain('Esperando la aprobación del administrador');
    });

    it('does not ask an administrator to request access', async () => {
      const { text, button, settle } = createPage({ admin: true });
      await settle();
      expect(text()).toContain('Puedes generar cotizaciones');
      expect(button('Solicitar acceso al administrador')).toBeUndefined();
    });
  });

  describe('generating a quote', () => {
    const fill = async (page: ReturnType<typeof createPage>) => {
      await page.settle();
      const form = page.fixture.debugElement.query((d) => d.name === 'app-quote-form').componentInstance;
      form.form.patchValue({ clientId: 'CLI-0142', licensePlate: 'KLXP42', description: 'Frenos' });
      form.items.at(0).patchValue({ concept: 'Pastillas', quantity: 1, unitPrice: 48_900 });
      return form;
    };

    it('opens the preview of the new quote and reloads the list', async () => {
      const created = makeQuote({ id: 'OT-2026-000103', clientId: 'CLI-0158' });
      const workOrders = vi.fn()
        .mockResolvedValueOnce(makeResult('GET', 200, [older]))
        .mockResolvedValueOnce(makeResult('GET', 200, [older, created]));
      const createOrder = vi.fn().mockResolvedValue(makeResult('POST /api/work-orders', 201, created));
      const page = createPage({ admin: true, api: { workOrders, createOrder } });
      const form = await fill(page);

      await form.submit();
      await page.settle();
      await page.settle();

      expect(page.element.querySelector('app-quote-preview')).not.toBeNull();
      expect(page.text()).toContain('Cotización N° 2026-000103');
      expect(page.text()).toContain('Vista previa');
      expect(workOrders).toHaveBeenCalledTimes(2);
      expect(page.element.querySelectorAll('.table-wrap tbody tr')).toHaveLength(2);
    });

    it('shows the error and the way to ask for access when the user has no permission', async () => {
      const createOrder = vi.fn().mockResolvedValue(
        makeResult('POST /api/work-orders', 403, null, { message: 'Necesitas la autorizacion', error: 'access_required' }),
      );
      const page = createPage({ access: makeAccess('NONE'), api: { createOrder } });
      const form = await fill(page);

      await form.submit();
      await page.settle();

      expect(page.element.querySelector('app-quote-form [role="alert"]')?.textContent).toContain('No tienes autorización');
      expect(page.element.querySelector('app-quote-preview')).toBeNull();
      // Se vuelve a consultar el permiso: tal vez lo acaban de revocar.
      expect(page.client.accessMine).toHaveBeenCalledTimes(2);
    });

    it('sends the request for access from the button inside the error', async () => {
      const createOrder = vi.fn().mockResolvedValue(
        makeResult('POST /api/work-orders', 403, null, { message: 'x', error: 'access_required' }),
      );
      const page = createPage({ api: { createOrder } });
      const form = await fill(page);
      await form.submit();
      await page.settle();

      (page.element.querySelector('app-quote-form .outcome button') as HTMLButtonElement).click();
      await page.settle();

      expect(page.client.requestAccess).toHaveBeenCalledOnce();
      expect(page.text()).toContain('Esperando la aprobación del administrador');
    });

    it('does not reload the list when the quote was not generated', async () => {
      const createOrder = vi.fn().mockResolvedValue(makeResult('POST /api/work-orders', 500, null, { message: 'x' }));
      const page = createPage({ api: { createOrder } });
      const form = await fill(page);

      await form.submit();
      await page.settle();

      expect(page.client.workOrders).toHaveBeenCalledOnce();
      expect(page.client.accessMine).toHaveBeenCalledOnce();
    });
  });

  describe('preview', () => {
    it('opens the quote that the user picks in the list and closes it', async () => {
      const page = createPage();
      await page.settle();

      (page.element.querySelector('.table-wrap tbody tr button') as HTMLButtonElement).click();
      page.fixture.detectChanges();
      expect(page.text()).toContain('Cotización N° 2026-000102');
      expect(page.text()).toContain('Descargar PDF');

      page.button('Cerrar')?.click();
      page.fixture.detectChanges();
      expect(page.element.querySelector('app-quote-preview')).toBeNull();
    });

    it('labels each "Ver" button with the number of its quote', async () => {
      const page = createPage();
      await page.settle();
      const labels = Array.from(page.element.querySelectorAll('.table-wrap tbody button')).map((b) => b.getAttribute('aria-label'));
      expect(labels).toEqual(['Ver la cotización 2026-000102', 'Ver la cotización 2026-000101']);
    });
  });

  it('says nothing technical to the user: no codes, routes, tokens or services', async () => {
    const page = createPage({ access: makeAccess('PENDING') });
    await page.settle();
    expect(page.text()).not.toMatch(/\/api\/|JWT|token|scope|BFF|Gateway|Entra|\b40[13]\b|Ver JSON/i);
  });
});
