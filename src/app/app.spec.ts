import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { App } from './app';
import { makeJwt, secondsFromNow } from './testing/jwt-fixtures';

const STORAGE_KEY = 'pedidos360.localAccessToken';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: MsalService, useValue: {} }],
    }).compileComponents();
  });

  it('renders the application identity and the environment', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pedidos360');
    expect(fixture.nativeElement.textContent).toContain('Entorno local');
  });

  it('shows no navigation or logout while signed out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.site-nav a')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Cerrar sesión');
  });

  it('shows navigation, the user and logout once the session is restored', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      makeJwt({ sub: 'local-demo-user', roles: ['viewer'], scope: 'orders.read events.read', exp: secondsFromNow(600) }),
    );
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Órdenes');
    expect(text).toContain('Perfil y token');
    expect(text).toContain('local-demo-user');
    expect(text).toContain('Cerrar sesión');
  });
});
