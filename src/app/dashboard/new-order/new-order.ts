import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiClient, SAMPLE_ORDER } from '../../api/api-client';
import { ApiResult, CreateOrderRequest, OrderItemInput, WorkOrder, formatClp, statusLabel } from '../../api/api.models';

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

@Component({
  selector: 'app-new-order',
  imports: [ReactiveFormsModule],
  templateUrl: './new-order.html',
  styleUrl: './new-order.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrder {
  private readonly api = inject(ApiClient);

  /** Resultado del POST, para que el panel lo registre junto a las demas rutas y recargue la lista. */
  readonly created = output<ApiResult<WorkOrder>>();
  readonly sending = signal(false);
  readonly outcome = signal<{ readonly ok: boolean; readonly text: string } | null>(null);

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
  /** Subtotal de cada renglon y total de la orden, como los calcula el servicio (el total no se envia). */
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
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.outcome.set({ ok: false, text: 'Revisa los campos marcados antes de crear la orden.' });
      return;
    }
    this.sending.set(true);
    this.outcome.set(null);
    const result = await this.api.createOrder(this.request());
    this.sending.set(false);
    this.outcome.set(this.describe(result));
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

  private describe(result: ApiResult<WorkOrder>): { ok: boolean; text: string } {
    if (!result.ok) {
      return { ok: false, text: `${result.status} ${statusLabel(result.status)}: ${result.message ?? 'No se pudo crear la orden.'}` };
    }
    const order = result.data;
    return { ok: true, text: order ? `Orden ${order.id} creada por ${formatClp(order.total)}.` : 'Orden creada.' };
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

  /** Deja el formulario listo para la siguiente orden: un renglon vacio y los datos del cliente en blanco. */
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
