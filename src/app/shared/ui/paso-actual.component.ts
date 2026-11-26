import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Viaje } from '../../core/api/operador-api.modelos';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { desdeEstatus, guia, lineaHitos, marcaDeGuia, posicionPaso, textoEstatus } from '../utils/estatus-viaje.util';
import { RELOJ } from '../../core/plataforma';
import { textoDesde } from '../utils/incidencias-abiertas.util';

/**
 * Bloque oscuro del paso actual (referencia aprobada): "Usted está aquí · paso N de M", el estatus en 40 px con su
 * nombre formal, "desde 11:10 a. m." y la línea de avance por hitos con el marcador amarillo en la posición real.
 * El estatus es el efectivo: incluye lo que el operador ya reportó y el servidor aún no refleja (con su aclaración).
 */
@Component({
  selector: 'app-paso-actual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="paso" aria-label="Paso actual">
      <div class="arriba">
        @if (posicion(); as p) {
          <span class="aqui">Usted está aquí · paso {{ p.n }} de {{ p.total }}</span>
        }
        <span class="folio">{{ viaje().folio }}</span>
      </div>
      <div class="estatus-fila">
        <p class="estatus">{{ estatus() }}</p>
        @if (desde() || marca()) {
          <span class="desde">
            {{ desde() }}
            @if (marca()) {
              <span class="marca-pendiente">{{ desde() ? ' · ' : '' }}{{ marca() }}</span>
            }
          </span>
        }
      </div>
      @if (linea(); as l) {
        <div
          class="linea"
          role="img"
          [attr.aria-label]="'Avance: paso ' + (posicion()?.n ?? '') + ' de ' + (posicion()?.total ?? '') + '. Hitos: ' + textosHitos()"
        >
          <div class="pista" aria-hidden="true">
            @for (p of l.piezas; track $index) {
              @switch (p.tipo) {
                @case ('punto') {
                  <span class="punto" [class.pasado]="p.pasado"></span>
                }
                @case ('tramo') {
                  <span class="tramo" [class.pasado]="p.pasado" [style.flex-grow]="p.largo"></span>
                }
                @case ('marcador') {
                  <span class="marcador"></span>
                }
              }
            }
          </div>
          <div class="etiquetas" aria-hidden="true">
            @for (e of l.etiquetas; track $index) {
              <span [class.pasado]="e.pasado">{{ e.texto }}</span>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .paso {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 16px 14px;
      border-radius: var(--radio-bloque);
      background: var(--c-paso);
      color: var(--c-paso-texto);
    }
    .arriba {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .aqui {
      padding: 3px 12px;
      border-radius: var(--radio-pildora);
      background: var(--c-marca);
      color: var(--c-marca-texto);
      font-size: var(--texto-chico);
      font-weight: 700;
    }
    .folio {
      color: var(--c-paso-suave);
      font-size: var(--texto-chico);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .estatus-fila {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      column-gap: 10px;
      margin-top: -6px;
    }
    .estatus {
      margin: 0;
      font-size: var(--texto-estatus);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .desde {
      color: var(--c-paso-suave);
      font-size: var(--texto-boton);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .marca-pendiente {
      color: var(--c-marca);
      font-size: var(--texto-chico);
      font-weight: 700;
    }
    .linea {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pista {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .punto {
      flex: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid var(--c-paso-punto);
    }
    .punto.pasado {
      border: none;
      background: var(--c-paso-texto);
    }
    .tramo {
      flex-basis: 0;
      height: 4px;
      border-radius: 2px;
      background: var(--c-paso-pendiente);
    }
    .tramo.pasado {
      background: var(--c-paso-texto);
    }
    .marcador {
      flex: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 4px solid var(--c-paso);
      background: var(--c-marca);
      outline: 2px solid var(--c-marca);
    }
    .etiquetas {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      color: var(--c-paso-suave);
      font-size: var(--texto-minimo); /* 13 px: solo aquí y en el menú */
      font-weight: 600;
    }
    .etiquetas .pasado {
      color: var(--c-paso-texto);
    }
  `,
})
export class PasoActualComponent {
  readonly viaje = input.required<Viaje>();
  private readonly cola = inject(ColaReportesService);

  private readonly guia = computed(() => guia(this.viaje(), this.cola.reportes()));
  protected readonly estatus = computed(() => textoEstatus(this.guia().estatus));
  protected readonly marca = computed(() => marcaDeGuia(this.guia()));
  protected readonly posicion = computed(() => posicionPaso(this.viaje(), this.cola.reportes()));
  private readonly reloj = inject(RELOJ);
  /** "desde 11:10 a. m." (hoy) o "desde el 25 nov, 11:10 p. m.". */
  protected readonly desde = computed(() => {
    const iso = desdeEstatus(this.viaje(), this.cola.reportes());
    return iso ? textoDesde(iso, this.reloj()) : '';
  });
  protected readonly linea = computed(() => lineaHitos(this.viaje(), this.cola.reportes()));
  protected readonly textosHitos = computed(() =>
    (this.linea()?.etiquetas ?? []).map((e) => `${e.texto}${e.pasado ? ' (hecho)' : ''}`).join(', '),
  );
}
