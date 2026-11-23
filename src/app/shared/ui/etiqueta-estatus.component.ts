import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EstatusViaje } from '../../core/api/operador-api.modelos';
import { presentacionEstatus } from '../utils/estatus-viaje.util';

/** Tamaño de letra respecto al texto normal (--texto-normal). Grande: al menos 1.4 (pedido de Carolina). */
export const ESCALA_ETIQUETA = { grande: 1.5, mediano: 1.1 } as const;

/**
 * Estatus del viaje como franja de color. Grande (ESCALA_ETIQUETA.grande veces el texto normal) en "Le toca" y en el detalle;
 * mediana en la lista de viajes. Texto y color salen de presentacionEstatus().
 */
@Component({
  selector: 'app-etiqueta-estatus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'etiqueta-estatus',
    '[class.etiqueta-grande]': "tamano() === 'grande'",
    '[class.etiqueta-mediana]': "tamano() === 'mediano'",
    '[style.background-color]': 'p().fondo',
    '[style.color]': 'p().tinta',
    '[style.font-size]': 'letra()',
  },
  template: `
    <span class="etiqueta-texto"><span class="solo-lector">Estatus: </span>{{ p().texto }}</span>
    @if (marca()) {
      <span class="etiqueta-marca">{{ marca() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-radius: 10px;
      font-weight: 800;
      line-height: 1.15;
    }
    :host(.etiqueta-grande) {
      padding: 10px 14px;
      margin: 6px 0 10px;
    }
    :host(.etiqueta-mediana) {
      display: inline-flex;
      padding: 5px 10px;
    }
    .solo-lector {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .etiqueta-marca {
      font-size: var(--texto-normal);
      font-weight: 700;
    }
    :host(.etiqueta-mediana) .etiqueta-marca {
      font-size: 0.8em;
    }
  `,
})
export class EtiquetaEstatusComponent {
  readonly estatus = input.required<EstatusViaje>();
  readonly tamano = input<'grande' | 'mediano'>('grande');
  /** Aclaración: "Pendiente de enviar", "Pendiente de confirmar por oficina". */
  readonly marca = input<string | null>(null);

  protected readonly p = computed(() => presentacionEstatus(this.estatus()));
  protected readonly letra = computed(() => `calc(var(--texto-normal) * ${ESCALA_ETIQUETA[this.tamano()]})`);
}
