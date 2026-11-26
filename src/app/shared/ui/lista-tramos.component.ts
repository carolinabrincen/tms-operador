import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TramoHoja } from '../../core/api/operador-api-m2.modelos';
import {
  ETIQUETA_ESTADO_TRAMO,
  EstadoTramo,
  estadoTramo,
  textoRecorrido,
} from '../utils/tramos-hoja.util';

/**
 * Hoja inferior con la lista compacta de los tramos de la salida: número, origen → destino y su estado en palabras
 * (Terminado, Actual, Siguiente, Pendiente) con un icono además del color. Al tocar uno, la hoja de ruta lo muestra.
 */
@Component({
  selector: 'app-lista-tramos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="velo" (click)="cerrar.emit()">
      <section
        class="hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-tramos"
        (click)="$event.stopPropagation()"
      >
        <h2 id="titulo-tramos">Tramos de la salida</h2>
        <ol class="lista-tramos">
          @for (t of tramos(); track t.orden; let i = $index) {
            @let e = estadoDe(i);
            <li>
              <button
                type="button"
                class="tramo-opcion estado-{{ e }}"
                [class.visto]="i === indiceVisto()"
                [attr.aria-current]="i === indiceVisto() ? 'true' : null"
                (click)="elegir.emit(i)"
              >
                <span class="tramo-icono" aria-hidden="true">
                  @switch (e) {
                    @case ('terminado') {
                      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    }
                    @case ('actual') {
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" class="lleno" /></svg>
                    }
                    @case ('siguiente') {
                      <svg viewBox="0 0 24 24">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    }
                    @case ('pendiente') {
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg>
                    }
                  }
                </span>
                <span class="tramo-textos">
                  <span class="tramo-numero">Tramo {{ i + 1 }}</span
                  >{{ ' ' }}
                  <span class="tramo-recorrido">{{ recorrido(t) }}</span> </span
                >{{ ' ' }}
                <span class="tramo-estado">{{ ETIQUETA_ESTADO[e] }}</span>
              </button>
            </li>
          }
        </ol>
        <div class="acciones">
          <button type="button" class="btn btn-secundario btn-bloque" (click)="cerrar.emit()">
            Cerrar
          </button>
        </div>
      </section>
    </div>
  `,
  styles: `
    /* Lista compacta de tramos: número, origen → destino y estado en palabras con su icono. */
    .lista-tramos {
      display: grid;
      gap: 10px;
      margin: var(--espacio-3) 0;
      padding: 0;
      list-style: none;
    }
    .tramo-opcion {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 64px;
      padding: 8px 12px;
      border: 1px solid var(--c-borde);
      border-radius: var(--radio-boton-medio);
      background: var(--c-superficie);
      color: var(--c-texto);
      text-align: left;
    }
    .tramo-opcion.visto {
      border: 1.5px solid var(--c-texto);
    }
    .tramo-icono {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }
    .tramo-icono svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tramo-icono .lleno {
      fill: currentColor;
      stroke: none;
    }
    .tramo-textos {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .tramo-numero {
      font-size: var(--texto-chico);
      font-weight: 700;
      color: var(--c-texto-suave);
    }
    .tramo-recorrido {
      font-size: var(--texto-normal);
      font-weight: 600;
      line-height: 1.3;
    }
    .tramo-estado {
      flex: none;
      font-size: var(--texto-chico);
      font-weight: 700;
    }
    .estado-terminado .tramo-icono {
      background: var(--c-exito-fondo);
      color: var(--c-exito-texto);
    }
    .estado-terminado .tramo-estado {
      color: var(--c-exito-texto);
    }
    .estado-actual .tramo-icono {
      background: var(--c-marca);
      color: var(--c-marca-texto);
    }
    .estado-siguiente .tramo-icono {
      background: var(--c-info-fondo);
      color: var(--c-info-texto);
    }
    .estado-siguiente .tramo-estado {
      color: var(--c-info-texto);
    }
    .estado-pendiente .tramo-icono {
      border: 1.5px solid var(--c-texto-suave);
      color: var(--c-texto-suave);
    }
    .estado-pendiente .tramo-estado {
      color: var(--c-texto-suave);
    }
  `,
})
export class ListaTramosComponent {
  readonly tramos = input.required<TramoHoja[]>();
  readonly indiceActual = input<number | null>(null);
  readonly indiceVisto = input<number | null>(null);
  readonly todoTerminado = input(false);
  readonly elegir = output<number>();
  readonly cerrar = output<void>();

  protected readonly ETIQUETA_ESTADO = ETIQUETA_ESTADO_TRAMO;
  protected readonly recorrido = textoRecorrido;

  protected estadoDe(i: number): EstadoTramo {
    return estadoTramo(i, this.indiceActual(), this.todoTerminado());
  }
}
