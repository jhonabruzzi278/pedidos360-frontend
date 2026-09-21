import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import {
  ACCESS_REQUIRED, AccessRequest, AccessStatus, ApiResult, WorkOrder, errorCode, formatClp,
} from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { AccessCard } from './access-card/access-card';
import { QuoteForm } from './quote-form/quote-form';
import { QuotePreview } from './quote-preview/quote-preview';
import { quoteNumber } from './quote-document';

/** Pagina principal: el permiso del usuario, la nueva cotizacion, su vista previa y las cotizaciones emitidas. */
@Component({
  selector: 'app-quotes-page',
  imports: [AccessCard, QuoteForm, QuotePreview],
  templateUrl: './quotes-page.html',
  styleUrl: './quotes-page.scss',
})
export class QuotesPage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly quotes = signal<WorkOrder[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  /** Nulo mientras se consulta o si la consulta fallo. */
  readonly access = signal<AccessRequest | null>(null);
  readonly accessBusy = signal(false);
  readonly preview = signal<WorkOrder | null>(null);

  readonly isAdmin = computed(() => this.auth.session()?.roles.includes('admin') ?? false);
  readonly accessStatus = computed<AccessStatus>(() => this.access()?.status ?? 'NONE');
  /** Las mas recientes primero. */
  readonly sortedQuotes = computed(() =>
    [...this.quotes()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
  );
  readonly formatClp = formatClp;
  readonly quoteNumber = quoteNumber;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const [quotes, access] = await Promise.all([this.api.workOrders(), this.api.accessMine()]);
    this.quotes.set(quotes.data ?? []);
    this.loadFailed.set(!quotes.ok);
    this.access.set(access.data);
    this.loading.set(false);
  }

  async refreshAccess(): Promise<void> {
    this.accessBusy.set(true);
    const result = await this.api.accessMine();
    if (result.ok) this.access.set(result.data);
    this.accessBusy.set(false);
  }

  async requestAccess(): Promise<void> {
    this.accessBusy.set(true);
    const result = await this.api.requestAccess();
    if (result.ok) this.access.set(result.data);
    this.accessBusy.set(false);
  }

  /** El formulario ya hizo el POST: si se genero se abre la vista previa; si falto el permiso se refresca el estado. */
  async onCreated(result: ApiResult<WorkOrder>): Promise<void> {
    if (result.ok && result.data) {
      this.open(result.data);
      const quotes = await this.api.workOrders();
      if (quotes.ok) this.quotes.set(quotes.data ?? []);
      return;
    }
    if (result.status === 403 && errorCode(result) === ACCESS_REQUIRED) await this.refreshAccess();
  }

  open(quote: WorkOrder): void {
    this.preview.set(quote);
    // La vista previa aparece sobre el formulario: se lleva al usuario hasta ella.
    setTimeout(() => this.host.nativeElement.querySelector('app-quote-preview')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  closePreview(): void {
    this.preview.set(null);
  }
}
