import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiClient, SAMPLE_ORDER } from '../../api/api-client';
import {
  ACCESS_REQUIRED, AccessStatus, ApiResult, CreateOrderRequest, OrderItemInput, WorkOrder, errorCode, formatClp,
} from '../../api/api.models';
import { quoteNumber } from '../quote-document';

const MAX_ITEMS = 50;
/** Patentes chilenas: AB1234 (formato antiguo), BCDF12 (actual) o de moto; el servicio acepta hasta 10 caracteres. */
const PLATE_PATTERN = /^[A-Za-z0-9]{5,7}$/;
const QUANTITY_PATTERN = /^\d{1,4}(\.\d{1,2})?$/;
const PRICE_PATTERN = /^\d{1,8}$/;

const MESSAGES = {
  required: 'Obligatorio',
  maxlength: 'Demasiado largo',
  plate: 'Entre 5 y 7 letras o números, por ejemplo BRTC63',
  quantity: 'Entre 0,01 y 1.000, con hasta 2 decimales',
  price: 'Pesos enteros, hasta 10.000.000',
} as const;

export type FieldKind = 'text' | 'plate' | 'quantity' | 'price';

export interface FormOutcome {
  readonly ok: boolean;
  readonly text: string;
}

type ItemGroup = FormGroup<{
  concept: FormControl<string>;
  quantity: FormControl<number | null>;
  unitPrice: FormControl<number | null>;
}>;

function newItem(item?: OrderItemInput): ItemGroup {
  return new FormGroup({
    concept: new FormControl(item?.concept ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(40)],
    }),
    quantity: new FormControl<number | null>(item?.quantity ?? 1, {
      validators: [Validators.required, Validators.min(0.01), Validators.max(1000), Validators.pattern(QUANTITY_PATTERN)],
    }),
    unitPrice: new FormControl<number | null>(item?.unitPrice ?? null, {
      validators: [Validators.required, Validators.min(0), Validators.max(10_000_000), Validators.pattern(PRICE_PATTERN)],
    }),
  });
}

/** Texto para el usuario: nunca codigos HTTP ni nombres de rutas. Esos quedan en la pagina de Diagnostico. */
export function describeResult(result: ApiResult<WorkOrder>): FormOutcome {
  if (result.ok) {
    const number = result.data ? ` N° ${quoteNumber(result.data.id)}` : '';
    return { ok: true, text: `Cotización${number} generada.` };
  }
  if (result.status === 403 && errorCode(result) === ACCESS_REQUIRED) {
    return { ok: false, text: 'No tienes autorización para generar cotizaciones. Solicita acceso al administrador.' };
  }
  if (result.status === 403) return { ok: false, text: 'Tu cuenta no tiene permiso para generar cotizaciones.' };
  if (result.status === 0) return { ok: false, text: 'No hay conexión con el servidor. Inténtalo de nuevo en unos minutos.' };
  return { ok: false, text: `No se pudo generar la cotización${result.message ? `: ${result.message}` : '.'}` };
}

@Component({
  selector: 'app-quote-form',
  imports: [ReactiveFormsModule],
  templateUrl: './quote-form.html',
  styleUrl: './quote-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteForm {
  private readonly api = inject(ApiClient);

  /** Estado de la solicitud de acceso del usuario: decide si se ofrece pedirlo o se avisa que esta pendiente. */
  readonly accessStatus = input<AccessStatus>('NONE');
  /** Resultado del POST, para que la pagina abra la vista previa y recargue la lista. */
  readonly created = output<ApiResult<WorkOrder>>();
  /** El usuario pulso "Solicitar acceso al administrador" tras ser rechazado por falta de permiso. */
  readonly accessRequested = output<void>();

  readonly sending = signal(false);
  readonly outcome = signal<FormOutcome | null>(null);
  readonly accessRequired = signal(false);

  readonly maxItems = MAX_ITEMS;
  readonly formatClp = formatClp;

  readonly items = new FormArray<ItemGroup>([newItem()], { validators: [Validators.required] });
  readonly form = new FormGroup({
    clientId: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    licensePlate: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(PLATE_PATTERN)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    items: this.items,
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  /** Subtotal de cada renglon y total de la cotizacion, como los calcula el servicio (el total no se envia). */
  readonly subtotals = computed(() =>
    (this.formValue().items ?? []).map((item) => Math.round((item.quantity ?? 0) * (item.unitPrice ?? 0))),
  );
  readonly total = computed(() => this.subtotals().reduce((sum, subtotal) => sum + subtotal, 0));

  addItem(): void {
    if (this.items.length < MAX_ITEMS) this.items.push(newItem());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  loadExample(): void {
    this.replaceItems(SAMPLE_ORDER.items);
    this.form.patchValue({
      clientId: SAMPLE_ORDER.clientId,
      licensePlate: SAMPLE_ORDER.licensePlate,
      description: SAMPLE_ORDER.description,
    });
    this.form.markAsUntouched();
    this.outcome.set(null);
    this.accessRequired.set(false);
  }

  askForAccess(): void {
    this.accessRequested.emit();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.outcome.set({ ok: false, text: 'Revisa los campos marcados antes de generar la cotización.' });
      return;
    }
    this.sending.set(true);
    this.outcome.set(null);
    this.accessRequired.set(false);
    const result = await this.api.createOrder(this.request());
    this.sending.set(false);
    this.outcome.set(describeResult(result));
    this.accessRequired.set(!result.ok && result.status === 403 && errorCode(result) === ACCESS_REQUIRED);
    if (result.ok) this.clear();
    this.created.emit(result);
  }

  /** Mensaje de error de un campo, solo cuando el usuario ya lo toco o intento enviar. */
  errorOf(control: AbstractControl, kind: FieldKind = 'text'): string | null {
    if (!control.invalid || !(control.touched || control.dirty)) return null;
    if (control.hasError('required')) return MESSAGES.required;
    if (kind !== 'text') return MESSAGES[kind];
    return control.hasError('maxlength') ? MESSAGES.maxlength : null;
  }

  private request(): CreateOrderRequest {
    const value = this.form.getRawValue();
    return {
      clientId: value.clientId.trim().toUpperCase(),
      licensePlate: value.licensePlate.trim().toUpperCase(),
      description: value.description.trim(),
      items: value.items.map((item) => ({
        concept: item.concept.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
    };
  }

  /** Deja el formulario listo para la siguiente cotizacion: un renglon vacio y los datos del cliente en blanco. */
  private clear(): void {
    this.replaceItems([]);
    this.form.controls.clientId.reset('');
    this.form.controls.licensePlate.reset('');
    this.form.controls.description.reset('');
  }

  private replaceItems(items: readonly OrderItemInput[]): void {
    this.items.clear();
    if (items.length === 0) this.items.push(newItem());
    items.forEach((item) => this.items.push(newItem(item)));
  }
}
