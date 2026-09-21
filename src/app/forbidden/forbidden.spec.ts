import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Forbidden } from './forbidden';

describe('Forbidden', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'acceso-denegado', component: Forbidden }])] });
  });

  it('lists the scopes and roles the route required', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/acceso-denegado?scopes=orders.write%20events.read&roles=admin', Forbidden);
    const text: string = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('orders.write');
    expect(text).toContain('events.read');
    expect(text).toContain('admin');
  });

  it('renders no lists when nothing is missing', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/acceso-denegado', Forbidden);
    expect(harness.routeNativeElement?.querySelectorAll('.chip').length).toBe(0);
  });
});
