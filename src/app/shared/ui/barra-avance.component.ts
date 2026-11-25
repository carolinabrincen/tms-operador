import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Viaje } from '../../core/api/operador-api.modelos';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { avanceViaje } from '../utils/estatus-viaje.util';

/**
 * Barra de avance en segmentos redondeados, uno por paso del operador: llenos los ya hechos, tenues los pendientes.
 * `sobreAzul`: dentro del encabezado azul (blanco sobre azul).
 */
@Component({
  selector: 'app-barra-avance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.sobre-azul]': 'sobreAzul()' },
  template: `
    @if (avance(); as a) {
      <div
        class="barra"
        role="progressbar"
        aria-label="Avance del viaje"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="a.total"
        [attr.aria-valuenow]="a.hechos"
        [attr.aria-valuetext]="a.hechos + ' de ' + a.total + ' pasos'"
      >
        @for (i of segmentos(); track i) {
          <span class="segmento" [class.hecho]="i < a.hechos"></span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .barra {
      display: flex;
      gap: 4px;
    }
    .segmento {
      flex: 1;
      height: 6px;
      border-radius: var(--radio-pildora);
      background: var(--c-borde);
    }
    .segmento.hecho {
      background: var(--c-primario);
    }
    :host(.sobre-azul) .segmento {
      background: var(--c-sobre-primario-tenue);
    }
    :host(.sobre-azul) .segmento.hecho {
      background: var(--c-sobre-primario);
    }
  `,
})
export class BarraAvanceComponent {
  readonly viaje = input.required<Viaje>();
  readonly sobreAzul = input(false);

  private readonly cola = inject(ColaReportesService);
  protected readonly avance = computed(() => avanceViaje(this.viaje(), this.cola.reportes()));
  protected readonly segmentos = computed(() => Array.from({ length: this.avance()?.total ?? 0 }, (_, i) => i));
}
