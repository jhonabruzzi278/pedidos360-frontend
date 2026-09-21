import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import { AccessDecision, AccessRequest, AccessStatus } from '../api/api.models';

const STATUS_TEXT: Readonly<Record<AccessStatus, string>> = {
  NONE: 'Sin solicitud',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export interface Notice {
  readonly ok: boolean;
  readonly text: string;
}

/** Solo administradores: las solicitudes de quienes piden permiso para generar cotizaciones. */
@Component({
  selector: 'app-access-requests-page',
  imports: [DatePipe],
  templateUrl: './access-requests-page.html',
  styleUrl: './access-requests-page.scss',
})
export class AccessRequestsPage implements OnInit {
  private readonly api = inject(ApiClient);

  readonly requests = signal<AccessRequest[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  /** Id de la solicitud que se esta decidiendo: deshabilita sus botones mientras responde el servidor. */
  readonly busyId = signal<number | null>(null);
  readonly notice = signal<Notice | null>(null);

  readonly pendingCount = computed(() => this.requests().filter((request) => request.status === 'PENDING').length);
  readonly statusText = (status: AccessStatus): string => STATUS_TEXT[status];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    await this.reload();
    this.loading.set(false);
  }

  async decide(request: AccessRequest, decision: AccessDecision): Promise<void> {
    if (request.id === null) return;
    this.busyId.set(request.id);
    this.notice.set(null);
    const result = await this.api.decideAccess(request.id, decision);
    this.busyId.set(null);
    const person = request.userName ?? 'El usuario';
    if (!result.ok) {
      this.notice.set({ ok: false, text: 'No se pudo registrar la decisión. Inténtalo de nuevo.' });
      return;
    }
    this.notice.set({
      ok: true,
      text: decision === 'APPROVED' ? `${person} ya puede generar cotizaciones.` : `${person} ya no puede generar cotizaciones.`,
    });
    await this.reload();
  }

  private async reload(): Promise<void> {
    const result = await this.api.accessRequests();
    this.requests.set(result.data ?? []);
    this.loadFailed.set(!result.ok);
  }
}
