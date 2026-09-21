import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { App } from './app';
import { makeJwt, secondsFromNow } from './testing/jwt-fixtures';

const STORAGE_KEY = 'pedidos360.localAccessToken';

function signIn(roles: string[], name = 'Camila Rojas'): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    makeJwt({ sub: 'user-1', name, roles, scope: 'orders.read orders.write events.read', exp: secondsFromNow(600) }),
  );
}

async function render() {
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const links = Array.from(element.querySelectorAll('a')).map((a) => a.textContent?.trim());
  return { element, links, text: element.textContent ?? '' };
}

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: MsalService, useValue: {} }],
    }).compileComponents();
  });

  it('renders the name of the product and no technical label', async () => {
    const { text } = await render();
    expect(text).toContain('Pedidos360');
    expect(text).not.toMatch(/Entra|Entorno local|token/i);
  });

  it('shows no navigation, footer or logout while signed out', async () => {
    const { element, text } = await render();
    expect(element.querySelector('.site-nav a')).toBeNull();
    expect(element.querySelector('.site-footer')).toBeNull();
    expect(text).not.toContain('Cerrar sesión');
  });

  it('shows the quotes, the user and logout once the session is restored', async () => {
    signIn([]);
    const { links, text } = await render();
    expect(links).toContain('Cotizaciones');
    expect(text).toContain('Camila Rojas');
    expect(text).toContain('Cerrar sesión');
  });

  it('keeps the requests page and the administrator badge for administrators only', async () => {
    signIn([]);
    const user = await render();
    expect(user.links).not.toContain('Solicitudes de acceso');
    expect(user.text).not.toContain('Administrador');
  });

  it('shows the administrator the requests page and a badge', async () => {
    signIn(['admin'], 'Admin Taller');
    const admin = await render();
    expect(admin.links).toContain('Solicitudes de acceso');
    expect(admin.text).toContain('Administrador');
  });

  it('puts the technical pages in the footer, out of the main navigation', async () => {
    signIn([]);
    const { element, links } = await render();
    const main = Array.from(element.querySelectorAll('.site-nav a')).map((a) => a.textContent?.trim());
    const footer = Array.from(element.querySelectorAll('.site-footer a')).map((a) => a.textContent?.trim());

    expect(main).toEqual(['Cotizaciones']);
    expect(footer).toEqual(['Diagnóstico técnico', 'Sesión y token']);
    expect(links).toContain('Diagnóstico técnico');
  });
});
