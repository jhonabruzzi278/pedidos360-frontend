import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../environments/environment';
import { makeJwt, secondsFromNow } from '../testing/jwt-fixtures';
import { Login } from './login';

describe('Login (local profile)', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: MsalService, useValue: {} }],
    }).compileComponents();
  });

  it('offers a viewer and an admin entry and no Entra ID sign-up', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Entrar como viewer', 'Entrar como admin']);
  });

  it('requests an admin token and goes to the orders page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('button')[1].click();
    http
      .expectOne(`${environment.apiBaseUrl}/dev/token?role=admin`)
      .flush({ accessToken: makeJwt({ sub: 'u', roles: ['admin'], scope: 'orders.read', exp: secondsFromNow(600) }) });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/ordenes');
    http.verify();
  });

  it('shows the error when the local token cannot be obtained', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('button')[0].click();
    http.expectOne(`${environment.apiBaseUrl}/dev/token?role=viewer`).flush('x', { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No fue posible iniciar sesión');
    http.verify();
  });
});
