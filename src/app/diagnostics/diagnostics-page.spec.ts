import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiClient } from '../api/api-client';
import { ApiLog } from '../api/api-log';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/session';
import { makeAccess, makeResult } from '../testing/quote-fixtures';
import { DiagnosticsPage } from './diagnostics-page';

const session = { accessToken: 'h.p.firma', roles: ['admin'], scopes: [] } as unknown as Session;

function createPage(api: Record<string, ReturnType<typeof vi.fn>>, current: Session | null = session) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ApiClient, useValue: api },
      { provide: AuthService, useValue: { session: signal(current) } },
    ],
  });
  const fixture = TestBed.createComponent(DiagnosticsPage);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const click = async (label: string) => {
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(label))?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };
  return { fixture, element, click, log: TestBed.inject(ApiLog) };
}

describe('DiagnosticsPage', () => {
  it('explains that there is nothing to show until the app or a test makes a call', () => {
    const { element } = createPage({});
    expect(element.textContent).toContain('Todavía no hay llamadas registradas');
  });

  it('shows the code and the JSON of every call that the app logged', () => {
    const { element, log, fixture } = createPage({});
    log.record(makeResult('GET /api/work-orders', 200, [{ id: 'OT-1' }]));
    log.record(makeResult('POST /api/work-orders', 403, null, { message: 'Sin acceso', error: 'access_required' }));
    fixture.detectChanges();

    const text = element.textContent ?? '';
    expect(text).toContain('GET /api/work-orders');
    expect(text).toContain('200 OK');
    expect(text).toContain('403 Sin permiso');
    expect(text).toContain('"error": "access_required"');
    expect(text).toContain('"id": "OT-1"');
  });

  it('says so when a response has no body', () => {
    const { fixture } = createPage({});
    expect(fixture.componentInstance.bodyText({ ...makeResult('GET /x', 204), body: null })).toBe('Sin cuerpo en la respuesta');
  });

  it('runs the three read routes with the session of the user', async () => {
    const api = {
      workOrders: vi.fn().mockResolvedValue(makeResult('GET /api/work-orders', 200, [])),
      events: vi.fn().mockResolvedValue(makeResult('GET /api/events', 200, [])),
      accessMine: vi.fn().mockResolvedValue(makeResult('GET /api/access-requests/me', 200, makeAccess('NONE'))),
    };
    const { click } = createPage(api);

    await click('Probar lecturas');

    expect(api.workOrders).toHaveBeenCalledOnce();
    expect(api.events).toHaveBeenCalledOnce();
    expect(api.accessMine).toHaveBeenCalledOnce();
  });

  it('runs every route without a token', async () => {
    const withoutToken = vi.fn().mockResolvedValue([]);
    const { click } = createPage({ withoutToken });
    await click('Llamar sin token');
    expect(withoutToken).toHaveBeenCalledOnce();
  });

  it('runs every route with the signature of the session token altered', async () => {
    const withTamperedToken = vi.fn().mockResolvedValue([]);
    const { click } = createPage({ withTamperedToken });
    await click('token alterado');
    expect(withTamperedToken).toHaveBeenCalledWith('h.p.firma');
  });

  it('does not run the tampered-token test when there is no session', async () => {
    const withTamperedToken = vi.fn();
    const { click } = createPage({ withTamperedToken }, null);
    await click('token alterado');
    expect(withTamperedToken).not.toHaveBeenCalled();
  });

  it('disables the tests while one is running and enables them again afterwards', async () => {
    let finish: (value: unknown[]) => void = () => undefined;
    const withoutToken = vi.fn().mockReturnValue(new Promise<unknown[]>((resolve) => (finish = resolve)));
    const { fixture, element } = createPage({ withoutToken });

    const running = fixture.componentInstance.callWithoutToken();
    fixture.detectChanges();
    expect(Array.from(element.querySelectorAll<HTMLButtonElement>('.actions button')).every((b) => b.disabled)).toBe(true);

    finish([]);
    await running;
    fixture.detectChanges();
    expect(Array.from(element.querySelectorAll<HTMLButtonElement>('.actions button')).some((b) => b.disabled)).toBe(false);
  });

  it('links to the session and token page', () => {
    const { element } = createPage({});
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/perfil');
  });
});
