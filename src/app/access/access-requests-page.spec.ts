import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../api/api-client';
import { AccessRequest } from '../api/api.models';
import { makeAccess, makeResult } from '../testing/quote-fixtures';
import { AccessRequestsPage } from './access-requests-page';

const pending = makeAccess('PENDING', { id: 1, userName: 'Camila Rojas', userEmail: 'camila@ejemplo.cl' });
const approved = makeAccess('APPROVED', { id: 2, userName: 'Valentina Soto', userEmail: 'valentina@ejemplo.cl', decidedBy: 'Admin Taller' });
const rejected = makeAccess('REJECTED', { id: 3, userName: 'Diego Fuentes', userEmail: null });

function createPage(api: Partial<Record<keyof ApiClient, ReturnType<typeof vi.fn>>>) {
  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
  const fixture = TestBed.createComponent(AccessRequestsPage);
  fixture.detectChanges();
  return fixture;
}

async function settle(fixture: ReturnType<typeof createPage>): Promise<HTMLElement> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const list = (data: AccessRequest[]) => vi.fn().mockResolvedValue(makeResult('GET /api/access-requests', 200, data));
const buttonsOf = (row: Element) => Array.from(row.querySelectorAll('button')).map((b) => b.textContent?.trim());

describe('AccessRequestsPage', () => {
  it('lists who asked, when, and the state of each request', async () => {
    const page = await settle(createPage({ accessRequests: list([pending, approved, rejected]) }));

    const rows = Array.from(page.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Camila Rojas');
    expect(rows[0].textContent).toContain('camila@ejemplo.cl');
    expect(rows[0].textContent).toContain('Pendiente');
    expect(rows[1].textContent).toContain('Aprobada');
    expect(rows[1].textContent).toContain('por Admin Taller');
    expect(rows[2].textContent).toContain('Rechazada');
  });

  it('offers to approve or reject a pending request, to revoke an approved one and to approve a rejected one', async () => {
    const page = await settle(createPage({ accessRequests: list([pending, approved, rejected]) }));
    const rows = Array.from(page.querySelectorAll('tbody tr'));

    expect(buttonsOf(rows[0])).toEqual(['Aprobar', 'Rechazar']);
    expect(buttonsOf(rows[1])).toEqual(['Revocar acceso']);
    expect(buttonsOf(rows[2])).toEqual(['Aprobar']);
  });

  it('counts the pending requests', async () => {
    const page = await settle(createPage({ accessRequests: list([pending, makeAccess('PENDING', { id: 9 }), approved]) }));
    expect(page.querySelector('.counter')?.textContent?.trim()).toBe('2 pendientes');
  });

  it('uses the singular for a single pending request', async () => {
    const page = await settle(createPage({ accessRequests: list([pending]) }));
    expect(page.querySelector('.counter')?.textContent?.trim()).toBe('1 pendiente');
  });

  it('approves a request, tells the administrator and reloads the list', async () => {
    const accessRequests = vi.fn()
      .mockResolvedValueOnce(makeResult('GET', 200, [pending]))
      .mockResolvedValueOnce(makeResult('GET', 200, [{ ...pending, status: 'APPROVED' as const }]));
    const decideAccess = vi.fn().mockResolvedValue(makeResult('POST', 200, makeAccess('APPROVED')));
    const fixture = createPage({ accessRequests, decideAccess });
    const page = await settle(fixture);

    (page.querySelector('tbody tr button') as HTMLButtonElement).click();
    await settle(fixture);
    await settle(fixture);

    expect(decideAccess).toHaveBeenCalledWith(1, 'APPROVED');
    expect(accessRequests).toHaveBeenCalledTimes(2);
    expect(page.querySelector('.notice')?.textContent).toContain('Camila Rojas ya puede generar cotizaciones');
    expect(page.querySelector('tbody tr')?.textContent).toContain('Aprobada');
  });

  it('rejects a request and says that the user can no longer quote', async () => {
    const decideAccess = vi.fn().mockResolvedValue(makeResult('POST', 200, makeAccess('REJECTED')));
    const fixture = createPage({ accessRequests: list([pending]), decideAccess });
    const page = await settle(fixture);

    (page.querySelectorAll('tbody tr button')[1] as HTMLButtonElement).click();
    await settle(fixture);

    expect(decideAccess).toHaveBeenCalledWith(1, 'REJECTED');
    expect(page.querySelector('.notice')?.textContent).toContain('Camila Rojas ya no puede generar cotizaciones');
  });

  it('revokes an approved access by rejecting it', async () => {
    const decideAccess = vi.fn().mockResolvedValue(makeResult('POST', 200, makeAccess('REJECTED')));
    const fixture = createPage({ accessRequests: list([approved]), decideAccess });
    const page = await settle(fixture);

    (page.querySelector('tbody tr button') as HTMLButtonElement).click();
    await settle(fixture);

    expect(decideAccess).toHaveBeenCalledWith(2, 'REJECTED');
  });

  it('reports a failed decision and keeps the list as it was', async () => {
    const accessRequests = list([pending]);
    const decideAccess = vi.fn().mockResolvedValue(makeResult('POST', 500, null, { message: 'x' }));
    const fixture = createPage({ accessRequests, decideAccess });
    const page = await settle(fixture);

    (page.querySelector('tbody tr button') as HTMLButtonElement).click();
    await settle(fixture);

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('No se pudo registrar la decisión');
    expect(accessRequests).toHaveBeenCalledTimes(1);
  });

  it('disables the buttons of the request that is being decided', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const decideAccess = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const fixture = createPage({ accessRequests: list([pending]), decideAccess });
    const page = await settle(fixture);

    const deciding = fixture.componentInstance.decide(pending, 'APPROVED');
    fixture.detectChanges();
    expect(Array.from(page.querySelectorAll<HTMLButtonElement>('tbody button')).every((b) => b.disabled)).toBe(true);

    finish(makeResult('POST', 200, makeAccess('APPROVED')));
    await deciding;
  });

  it('ignores a request that has no id', async () => {
    const decideAccess = vi.fn();
    const fixture = createPage({ accessRequests: list([]), decideAccess });
    await settle(fixture);

    await fixture.componentInstance.decide(makeAccess('NONE'), 'APPROVED');

    expect(decideAccess).not.toHaveBeenCalled();
  });

  it('shows an empty state when nobody has asked yet', async () => {
    const page = await settle(createPage({ accessRequests: list([]) }));
    expect(page.textContent).toContain('Nadie ha pedido acceso todavía');
    expect(page.querySelector('table')).toBeNull();
  });

  it('shows an error instead of an empty list when the requests cannot be loaded', async () => {
    const failing = vi.fn().mockResolvedValue(makeResult('GET', 500, null, { message: 'x' }));
    const page = await settle(createPage({ accessRequests: failing }));
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar las solicitudes');
    expect(page.textContent).not.toContain('Nadie ha pedido acceso');
  });

  it('reloads on demand', async () => {
    const accessRequests = list([pending]);
    const fixture = createPage({ accessRequests });
    const page = await settle(fixture);

    (Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.includes('Actualizar')) as HTMLButtonElement).click();
    await settle(fixture);

    expect(accessRequests).toHaveBeenCalledTimes(2);
  });

  it('says nothing technical: no codes, routes or tokens', async () => {
    const page = await settle(createPage({ accessRequests: list([pending, approved, rejected]) }));
    expect(page.textContent).not.toMatch(/\/api\/|JWT|token|scope|BFF|Gateway|\b40[13]\b/i);
  });
});
