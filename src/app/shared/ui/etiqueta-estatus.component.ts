import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EstatusViaje } from '../../core/api/operador-api.modelos';
import { presentacionEstatus } from '../utils/estatus-viaje.util';

/**
 * Tamaño de letra respecto al texto normal (--texto-normal, 16 px). Grande: al menos 1.4 (pedido de Carolina).
 * Encabezado: el estatus en blanco dentro del encabezado azul de Mi viaje, de 28 a 32 px (30 px).
 */
export const ESCALA_ETIQUETA = { encabezado: 1.875, grande: 1.5, mediano: 1.1 } as const;

export type TamanoEtiqueta = keyof typeof ESCALA_ETIQUETA;

/**
 * Estatus del viaje. Encabezado: en blanco y muy grande dentro del azul de Mi viaje. Grande: píldora de su color en
 * el detalle. Mediana: en la lista de viajes. Texto y color salen de presentacionEstatus().
 */
@Component({
  selector: 'app-etiqueta-estatus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'etiqueta-estatus',
    '[class.etiqueta-encabezado]': "tamano() === 'encabezado'",
    '[class.etiqueta-grande]': "tamano() === 'grande'",
    '[class.etiqueta-mediana]': "tamano() === 'mediano'",
    '[style.background-color]': "tamano() === 'encabezado' ? null : p().fondo",
    '[style.color]': "tamano() === 'encabezado' ? null : p().tinta",
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
      align-items: flex-start;
      gap: 4px;
      border-radius: var(--radio-boton);
      font-weight: var(--peso-titulo);
      line-height: 1.15;
    }
    :host(.etiqueta-encabezado) {
      color: var(--c-sobre-primario);
      margin: 0 0 var(--espacio-3);
      letter-spacing: -0.01em;
    }
    :host(.etiqueta-grande) {
      padding: 10px 16px;
      margin: 0 0 var(--espacio-3);
    }
    :host(.etiqueta-mediana) {
      display: inline-flex;
      padding: 4px 12px;
      border-radius: var(--radio-pildora);
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
      font-size: var(--texto-chico);
      font-weight: var(--peso-medio);
    }
    :host(.etiqueta-encabezado) .etiqueta-marca {
      padding: 2px 10px;
      border-radius: var(--radio-pildora);
      background: var(--c-sobre-primario);
      color: var(--c-primario);
    }
    :host(.etiqueta-mediana) .etiqueta-marca {
      font-size: 0.8em;
    }
  `,
})
export class EtiquetaEstatusComponent {
  readonly estatus = input.required<EstatusViaje>();
  readonly tamano = input<TamanoEtiqueta>('grande');
  /** Aclaración: "Pendiente de enviar", "Pendiente de confirmar por oficina". */
  readonly marca = input<string | null>(null);

  protected readonly p = computed(() => presentacionEstatus(this.estatus()));
  protected readonly letra = computed(() => `calc(var(--texto-normal) * ${ESCALA_ETIQUETA[this.tamano()]})`);
}
