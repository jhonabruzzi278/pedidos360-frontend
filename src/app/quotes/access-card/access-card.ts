import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessRequest } from '../../api/api.models';

/**
 * Estado del permiso del usuario para generar cotizaciones: sin solicitud, pendiente, aprobado o rechazado.
 * El administrador no necesita pedirlo. Solo presenta: las acciones las resuelve la pagina.
 */
@Component({
  selector: 'app-access-card',
  imports: [RouterLink],
  templateUrl: './access-card.html',
  styleUrl: './access-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessCard {
  /** Nulo mientras se consulta. */
  readonly access = input<AccessRequest | null>(null);
  readonly admin = input(false);
  readonly busy = input(false);
  readonly requested = output<void>();
  readonly refreshed = output<void>();
}
