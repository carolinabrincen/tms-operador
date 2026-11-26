import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Viaje } from '../../core/api/operador-api.modelos';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { desdeEstatus, guia, lineaHitos, marcaDeGuia, posicionPaso, textoEstatus } from '../utils/estatus-viaje.util';
import { RELOJ } from '../../core/plataforma';
import { textoDesde } from '../utils/incidencias-abiertas.util';
import { MedirTexto, tamanoEstatus } from '../utils/tamano-estatus.util';

/**
 * Bloque oscuro del paso actual (referencia aprobada): "Usted está aquí · paso N de M", el estatus en 40 px con su
 * nombre formal, "desde 11:10 a. m." y la línea de avance por hitos con el marcador amarillo en la posición real.
 * El estatus es el efectivo: incluye lo que el operador ya reportó y el servidor aún no refleja (con su aclaración).
 * Si el nombre no cabe en un renglón a 40 px, baja por pasos hasta 28 px (medido con la letra real); solo si ni así
 * cabe, usa dos renglones.
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
      <div class="estatus-fila" #fila>
        <p class="estatus" [style.font-size.rem]="tamano().rem" [class.dos-renglones]="tamano().dosRenglones">{{ estatus() }}</p>
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
    /* 40 px en un renglón; si no cabe, baja por pasos hasta 28 px; solo entonces, dos renglones. */
    .estatus {
      margin: 0;
      font-size: var(--texto-estatus);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .estatus.dos-renglones {
      white-space: normal;
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
  /** Ancho del renglón del estatus, tamaño de 1rem y si ya cargó la letra (para volver a medir). */
  private readonly anchoFila = signal<number | null>(null);
  private readonly raizPx = signal(16);
  private readonly letraLista = signal(0);
  private medir: MedirTexto | undefined;
  private readonly fila = viewChild<ElementRef<HTMLElement>>('fila');
  protected readonly tamano = computed(() => {
    this.letraLista();
    return tamanoEstatus(this.estatus(), this.anchoFila(), this.raizPx(), this.medir);
  });

  constructor() {
    const documento = inject(DOCUMENT);
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      const ventana = documento.defaultView;
      const fila = this.fila()?.nativeElement;
      // Sin medición de pantalla (pruebas o navegador muy viejo): se estima por la longitud del texto.
      if (!ventana || !fila || typeof ventana.ResizeObserver === 'undefined') return;
      this.raizPx.set(parseFloat(ventana.getComputedStyle(documento.documentElement).fontSize) || 16);
      const contexto = documento.createElement('canvas').getContext('2d');
      if (contexto) {
        this.medir = (texto, px) => {
          contexto.font = `700 ${px}px Manrope, system-ui, sans-serif`;
          return contexto.measureText(texto).width - 0.02 * px * texto.length;
        };
      }
      const observador = new ventana.ResizeObserver(() => {
        this.anchoFila.set(fila.clientWidth);
        this.raizPx.set(parseFloat(ventana.getComputedStyle(documento.documentElement).fontSize) || 16);
      });
      observador.observe(fila);
      destruir.onDestroy(() => observador.disconnect());
      // Cuando termina de cargar Manrope, se vuelve a medir con la letra real.
      void documento.fonts?.ready.then(() => this.letraLista.update((n) => n + 1));
    });
  }

  protected readonly textosHitos = computed(() =>
    (this.linea()?.etiquetas ?? []).map((e) => `${e.texto}${e.pasado ? ' (hecho)' : ''}`).join(', '),
  );
}
