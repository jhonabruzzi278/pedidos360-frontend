import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/session';
import { Profile } from './profile';

const session: Session = {
  name: 'Ana Pérez',
  username: 'ana@jdv.onmicrosoft.com',
  tenantId: 'tenant-1',
  roles: ['admin'],
  scopes: ['orders.read', 'orders.write'],
  expiresAt: new Date('2027-01-15T08:00:00Z'),
  accessToken: 'header.payload.firma',
  claims: { aud: 'api-client-id', roles: ['admin'] },
};

function createProfile(current: Session | null) {
  TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { session: signal(current) } }] });
  const fixture = TestBed.createComponent(Profile);
  fixture.detectChanges();
  return fixture;
}

describe('Profile', () => {
  it('shows identity, roles, scopes and the decoded claims', () => {
    const text: string = createProfile(session).nativeElement.textContent;
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('ana@jdv.onmicrosoft.com');
    expect(text).toContain('tenant-1');
    expect(text).toContain('orders.write');
    expect(text).toContain('"aud": "api-client-id"');
  });

  it('flags a token without roles or scopes', () => {
    const text: string = createProfile({ ...session, roles: [], scopes: [] }).nativeElement.textContent;
    expect(text).toContain('sin rol');
    expect(text).toContain('sin scopes');
  });

  it('says so when there is no session', () => {
    expect(createProfile(null).nativeElement.textContent).toContain('No hay una sesión activa');
  });

  it('copies the access token to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fixture = createProfile(session);
    await fixture.componentInstance.copyToken();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith('header.payload.firma');
    expect(fixture.nativeElement.textContent).toContain('Token copiado');
    vi.unstubAllGlobals();
  });

  it('reports a blocked clipboard', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const fixture = createProfile(session);
    await fixture.componentInstance.copyToken();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('bloqueó el portapapeles');
    vi.unstubAllGlobals();
  });
});
