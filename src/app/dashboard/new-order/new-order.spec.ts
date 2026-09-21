import { TestBed } from '@angular/core/testing';
import { ApiClient, SAMPLE_ORDER } from '../../api/api-client';
import { ApiResult, WorkOrder } from '../../api/api.models';
import { NewOrder } from './new-order';

const created: WorkOrder = {
  id: 'OT-2026-3F9A12CD', clientId: 'CLI-0142', licensePlate: 'KLXP42', description: 'x', total: 7900, itemCount: 1, calculatedSubtotal: 7900,
};

function result(status: number, data: WorkOrder | null, message: string | null = null): ApiResult<WorkOrder> {
  return { route: 'POST /api/work-orders', status, ok: status < 400, data, message, body: data };
}

function createForm(createOrder = vi.fn().mockResolvedValue(result(201, created))) {
  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: { createOrder } }] });
  const fixture = TestBed.createComponent(NewOrder);
  fixture.detectChanges();
  const component = fixture.componentInstance;
  const emitted: ApiResult<WorkOrder>[] = [];
  component.created.subscribe((value) => emitted.push(value));
  return { fixture, component, createOrder, emitted };
}

function fillValidOrder(component: NewOrder): void {
  component.form.patchValue({ clientId: 'cli-0142', licensePlate: 'klxp42', description: '  Mantención  ' });
  component.items.at(0).patchValue({ concept: ' Filtro de aceite ', quantity: 1, unitPrice: 7900 });
}

describe('NewOrder', () => {
  it('starts empty with a single item row and a zero total', () => {
    const { component, fixture } = createForm();
    expect(component.items.length).toBe(1);
    expect(component.total()).toBe(0);
    expect(fixture.nativeElement.textContent).toMatch(/Total de la orden\s*\$\s?0/);
  });

  it('does not send an invalid order and marks the fields', async () => {
    const { component, createOrder, emitted } = createForm();
    await component.submit();
    expect(createOrder).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
    expect(component.form.controls.clientId.touched).toBe(true);
    expect(component.outcome()).toMatchObject({ ok: false });
  });

  it('shows the message of each invalid field after trying to send', async () => {
    const { component, fixture } = createForm();
    await component.submit();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Obligatorio');
    expect(text).toContain('Revisa los campos marcados');
  });

  it.each(['ABC', 'ABCDEFGH', 'AB 123', 'AB-123'])('rejects the license plate %s', (plate) => {
    const { component } = createForm();
    component.form.controls.licensePlate.setValue(plate);
    expect(component.form.controls.licensePlate.valid).toBe(false);
    expect(component.errorOf(component.form.controls.licensePlate, 'plate')).toBeNull(); // aun sin tocar
    component.form.controls.licensePlate.markAsTouched();
    expect(component.errorOf(component.form.controls.licensePlate, 'plate')).toContain('5 y 7');
  });

  it.each(['AB1234', 'BRTC63', 'ab1234'])('accepts the license plate %s', (plate) => {
    const { component } = createForm();
    component.form.controls.licensePlate.setValue(plate);
    expect(component.form.controls.licensePlate.valid).toBe(true);
  });

  it.each([
    [0, false], [0.01, true], [1.5, true], [1000, true], [1000.01, false], [1.234, false], [-1, false],
  ])('validates the quantity %d as %s', (quantity, valid) => {
    const { component } = createForm();
    component.items.at(0).controls.quantity.setValue(quantity);
    expect(component.items.at(0).controls.quantity.valid).toBe(valid);
  });

  it.each([[0, true], [7900, true], [10_000_000, true], [10_000_001, false], [99.5, false], [-1, false]])(
    'validates the unit price %d as %s',
    (price, valid) => {
      const { component } = createForm();
      component.items.at(0).controls.unitPrice.setValue(price);
      expect(component.items.at(0).controls.unitPrice.valid).toBe(valid);
    },
  );

  it('calculates the subtotal of each row and the total of the order', () => {
    const { component } = createForm();
    component.items.at(0).patchValue({ concept: 'A', quantity: 4, unitPrice: 9500 });
    component.addItem();
    component.items.at(1).patchValue({ concept: 'B', quantity: 1.5, unitPrice: 22000 });
    expect(component.subtotals()).toEqual([38000, 33000]);
    expect(component.total()).toBe(71000);
  });

  it('adds rows up to the limit of the service and keeps at least one', () => {
    const { component } = createForm();
    for (let i = 0; i < 60; i++) component.addItem();
    expect(component.items.length).toBe(component.maxItems);
    component.removeItem(0);
    expect(component.items.length).toBe(component.maxItems - 1);
    while (component.items.length > 1) component.removeItem(0);
    component.removeItem(0);
    expect(component.items.length).toBe(1);
  });

  it('loads the example order into the form', () => {
    const { component } = createForm();
    component.loadExample();
    expect(component.form.controls.clientId.value).toBe(SAMPLE_ORDER.clientId);
    expect(component.items.length).toBe(SAMPLE_ORDER.items.length);
    expect(component.form.valid).toBe(true);
    expect(component.total()).toBe(48900 + 33000);
  });

  it('sends the cleaned data, reports the new order and empties the form', async () => {
    const { component, createOrder, emitted } = createForm();
    fillValidOrder(component);
    await component.submit();

    expect(createOrder).toHaveBeenCalledWith({
      clientId: 'CLI-0142',
      licensePlate: 'KLXP42',
      description: 'Mantención',
      items: [{ concept: 'Filtro de aceite', quantity: 1, unitPrice: 7900 }],
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].status).toBe(201);
    expect(component.outcome()).toMatchObject({ ok: true });
    expect(component.outcome()?.text).toContain('OT-2026-3F9A12CD');
    expect(component.outcome()?.text).toMatch(/\$\s?7\.900/);
    expect(component.form.controls.clientId.value).toBe('');
    expect(component.items.length).toBe(1);
    expect(component.items.at(0).controls.quantity.value).toBe(1);
    expect(component.sending()).toBe(false);
  });

  it('keeps what the user typed and shows the reason when the service rejects the order', async () => {
    const { component, emitted } = createForm(vi.fn().mockResolvedValue(result(403, null, 'Permisos insuficientes')));
    fillValidOrder(component);
    await component.submit();

    expect(emitted[0].status).toBe(403);
    expect(component.outcome()).toEqual({ ok: false, text: '403 Sin permiso: Permisos insuficientes' });
    expect(component.form.controls.clientId.value).toBe('cli-0142');
  });

  it('disables the button while the order is being sent', async () => {
    let finish: (value: ApiResult<WorkOrder>) => void = () => undefined;
    const pending = new Promise<ApiResult<WorkOrder>>((resolve) => (finish = resolve));
    const { component, fixture } = createForm(vi.fn().mockReturnValue(pending));
    fillValidOrder(component);
    const submitting = component.submit();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Creando');

    finish(result(201, created));
    await submitting;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });
});
