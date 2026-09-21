import { TestBed } from '@angular/core/testing';
import { ApiClient, SAMPLE_ORDER } from '../../api/api-client';
import { ApiResult, WorkOrder } from '../../api/api.models';
import { makeQuote, makeResult } from '../../testing/quote-fixtures';
import { QuoteForm, describeResult } from './quote-form';

const created: WorkOrder = makeQuote({ id: 'OT-2026-3F9A12CD', total: 7900, itemCount: 1, calculatedSubtotal: 7900 });

function result(status: number, data: WorkOrder | null, message: string | null = null, error?: string): ApiResult<WorkOrder> {
  return makeResult('POST /api/work-orders', status, data, { message, error });
}

function createForm(createOrder = vi.fn().mockResolvedValue(result(201, created))) {
  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: { createOrder } }] });
  const fixture = TestBed.createComponent(QuoteForm);
  fixture.detectChanges();
  const component = fixture.componentInstance;
  const emitted: ApiResult<WorkOrder>[] = [];
  component.created.subscribe((value) => emitted.push(value));
  return { fixture, component, createOrder, emitted };
}

function fillValidOrder(component: QuoteForm): void {
  component.form.patchValue({ clientId: 'cli-0142', licensePlate: 'klxp42', description: '  Mantención  ' });
  component.items.at(0).patchValue({ concept: ' Filtro de aceite ', quantity: 1, unitPrice: 7900 });
}

describe('QuoteForm', () => {
  it('starts empty with a single item row and a zero total', () => {
    const { component, fixture } = createForm();
    expect(component.items.length).toBe(1);
    expect(component.total()).toBe(0);
    expect(fixture.nativeElement.textContent).toMatch(/Total\s*\$\s?0\s*IVA incluido/);
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
    expect(component.outcome()?.text).toBe('Cotización N° 2026-3F9A12CD generada.');
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
    expect(component.outcome()).toEqual({ ok: false, text: 'Tu cuenta no tiene permiso para generar cotizaciones.' });
    expect(component.accessRequired()).toBe(false);
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
    expect(button.textContent).toContain('Generando');

    finish(result(201, created));
    await submitting;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });
});

describe('QuoteForm without permission to quote', () => {
  const refused = () => result(403, null, 'Necesitas la autorizacion del administrador', 'access_required');

  function sendRefused(status: 'NONE' | 'PENDING' | 'REJECTED' = 'NONE') {
    const form = createForm(vi.fn().mockResolvedValue(refused()));
    form.fixture.componentRef.setInput('accessStatus', status);
    fillValidOrder(form.component);
    return form;
  }

  const buttons = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).map((b) => b.textContent?.trim());

  it('shows an error that asks the user to request access', async () => {
    const { component, fixture } = sendRefused();
    await component.submit();
    fixture.detectChanges();

    expect(component.outcome()).toEqual({
      ok: false,
      text: 'No tienes autorización para generar cotizaciones. Solicita acceso al administrador.',
    });
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Solicita acceso');
  });

  it('never shows an HTTP code or a route to the user', async () => {
    const { component, fixture } = sendRefused();
    await component.submit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toMatch(/403|401|\/api\/|access_required/);
  });

  it('offers the button to request access and emits when it is pressed', async () => {
    const { component, fixture } = sendRefused();
    const requested = vi.fn();
    component.accessRequested.subscribe(requested);
    await component.submit();
    fixture.detectChanges();

    expect(buttons(fixture)).toContain('Solicitar acceso al administrador');
    fixture.nativeElement.querySelectorAll('.outcome button')[0].click();
    expect(requested).toHaveBeenCalledOnce();
  });

  it('does not offer to ask again while the request is pending, and says so', async () => {
    const { component, fixture } = sendRefused('PENDING');
    await component.submit();
    fixture.detectChanges();

    expect(buttons(fixture)).not.toContain('Solicitar acceso al administrador');
    expect(fixture.nativeElement.textContent).toContain('pendiente de aprobación');
  });

  it('offers to ask again after a rejection', async () => {
    const { component, fixture } = sendRefused('REJECTED');
    await component.submit();
    fixture.detectChanges();

    expect(buttons(fixture)).toContain('Solicitar acceso al administrador');
  });

  it('keeps what the user typed so nothing is lost while waiting for the permission', async () => {
    const { component } = sendRefused();
    await component.submit();

    expect(component.form.controls.licensePlate.value).toBe('klxp42');
    expect(component.items.at(0).controls.concept.value).toBe(' Filtro de aceite ');
  });

  it('clears the warning on the next attempt', async () => {
    const createOrder = vi.fn().mockResolvedValueOnce(refused()).mockResolvedValueOnce(result(201, created));
    const { component, fixture } = createForm(createOrder);
    fillValidOrder(component);
    await component.submit();
    expect(component.accessRequired()).toBe(true);

    fillValidOrder(component);
    await component.submit();
    fixture.detectChanges();
    expect(component.accessRequired()).toBe(false);
    expect(component.outcome()).toMatchObject({ ok: true });
  });
});

describe('describeResult', () => {
  it('celebrates a generated quote with its number', () => {
    expect(describeResult(result(201, created))).toEqual({ ok: true, text: 'Cotización N° 2026-3F9A12CD generada.' });
  });

  it('tells apart the missing approval from any other refusal', () => {
    expect(describeResult(result(403, null, 'x', 'access_required')).text).toContain('Solicita acceso');
    expect(describeResult(result(403, null, 'x', 'forbidden')).text).toBe('Tu cuenta no tiene permiso para generar cotizaciones.');
  });

  it('explains a connection failure without technical words', () => {
    expect(describeResult(result(0, null, 'No hay conexión con el servidor.')).text).toContain('No hay conexión');
  });

  it('reports any other error with the reason the service gave', () => {
    expect(describeResult(result(400, null, 'La solicitud fue rechazada')).text)
      .toBe('No se pudo generar la cotización: La solicitud fue rechazada');
    expect(describeResult({ ...result(500, null), message: null }).text).toBe('No se pudo generar la cotización.');
  });
});
