import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
  });
  it('renders the application identity', () => {
    const fixture = TestBed.createComponent(App); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pedidos360');
  });
});
