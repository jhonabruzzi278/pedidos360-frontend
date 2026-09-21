import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { WorkOrder } from '../../api/api.models';
import { COMPANY, buildQuoteDocument } from '../quote-document';
import { QuotePdf } from '../quote-pdf';

/** La cotizacion tal como la vera el cliente, con el boton para descargarla en PDF. */
@Component({
  selector: 'app-quote-preview',
  templateUrl: './quote-preview.html',
  styleUrl: './quote-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotePreview {
  private readonly pdf = inject(QuotePdf);

  readonly quote = input.required<WorkOrder>();
  readonly closed = output<void>();

  readonly company = COMPANY;
  readonly document = computed(() => buildQuoteDocument(this.quote()));
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);

  async download(): Promise<void> {
    this.downloading.set(true);
    this.error.set(null);
    try {
      await this.pdf.download(this.quote());
    } catch {
      this.error.set('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      this.downloading.set(false);
    }
  }
}
