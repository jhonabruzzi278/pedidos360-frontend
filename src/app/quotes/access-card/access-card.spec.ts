import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccessRequest } from '../../api/api.models';
import { makeAccess } from '../../testing/quote-fixtures';
import { AccessCard } from './access-card';

function createCard(access: AccessRequest | null, admin = false, busy = false) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(AccessCard);
  fixture.componentRef.setInput('access', access);
  fixture.componentRef.setInput('admin', admin);
  fixture.componentRef.setInput('busy', busy);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    text: () => element.textContent ?? '',
    state: () => element.querySelector('.card')?.getAttribute('data-state'),
    buttons: () => Array.from(element.querySelectorAll<HTMLButtonElement>('button')),
    element,
  };
}

describe('AccessCard', () => {
  it('says the access is being checked while nothing is known yet', () => {
    const card = createCard(null);
    expect(card.state()).toBe('loading');
    expect(card.text()).toContain('Consultando tu acceso');
    expect(card.buttons()).toHaveLength(0);
  });

  it('tells a user without a request that they cannot quote and offers to ask', () => {
    const card = createCard(makeAccess('NONE'));
    expect(card.state()).toBe('none');
    expect(card.text()).toContain('Aún no puedes generar cotizaciones');
    expect(card.buttons().map((b) => b.textContent?.trim())).toEqual(['Solicitar acceso al administrador']);
  });

  it('emits when the user presses the button to request access', () => {
    const card = createCard(makeAccess('NONE'));
    const requested = vi.fn();
    card.fixture.componentInstance.requested.subscribe(requested);
    card.buttons()[0].click();
    expect(requested).toHaveBeenCalledOnce();
  });

  it('shows a pending request without offering to ask again, only to refresh', () => {
    const card = createCard(makeAccess('PENDING'));
    const refreshed = vi.fn();
    card.fixture.componentInstance.refreshed.subscribe(refreshed);

    expect(card.state()).toBe('pending');
    expect(card.text()).toContain('Esperando la aprobación del administrador');
    expect(card.buttons().map((b) => b.textContent?.trim())).toEqual(['Actualizar estado']);
    card.buttons()[0].click();
    expect(refreshed).toHaveBeenCalledOnce();
  });

  it('shows who approved the access', () => {
    const card = createCard(makeAccess('APPROVED', { decidedBy: 'Admin Taller' }));
    expect(card.state()).toBe('approved');
    expect(card.text()).toContain('Ya puedes generar cotizaciones');
    expect(card.text()).toContain('Admin Taller');
    expect(card.buttons()).toHaveLength(0);
  });

  it('falls back to "el administrador" when the approver is not known', () => {
    expect(createCard(makeAccess('APPROVED', { decidedBy: null })).text()).toContain('el administrador');
  });

  it('lets a rejected user ask again', () => {
    const card = createCard(makeAccess('REJECTED'));
    expect(card.state()).toBe('rejected');
    expect(card.text()).toContain('no aprobó tu solicitud');
    expect(card.buttons().map((b) => b.textContent?.trim())).toEqual(['Volver a solicitar']);
  });

  it.each(['NONE', 'PENDING', 'REJECTED'] as const)('disables the button of a %s state while a request is in flight', (status) => {
    expect(createCard(makeAccess(status), false, true).buttons()[0].disabled).toBe(true);
  });

  it('shows an administrator that they can quote and decide, with a link to the requests', () => {
    const card = createCard(makeAccess('NONE'), true);
    expect(card.state()).toBe('admin');
    expect(card.text()).toContain('Administrador');
    expect(card.text()).toContain('Puedes generar cotizaciones');
    expect(card.element.querySelector('a')?.getAttribute('href')).toBe('/solicitudes');
    expect(card.buttons()).toHaveLength(0);
  });
});
