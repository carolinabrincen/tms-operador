import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { EvidenciaLocal } from '../../core/evidencias/evidencia-local';
import { ETIQUETA_ESTADO_FOTO, textoEvidencia } from '../utils/evidencias.util';
import { liberarUrl, urlDeImagen } from '../utils/foto.util';
import { cuandoNegocio, fechaHoraNegocio } from '../utils/zona-negocio.util';

/** Una foto de la cola del teléfono con su estado: Pendiente, Enviada, Recibida, Anulada por la oficina o No aceptada. */
@Component({
  selector: 'app-foto-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = foto();
    <article class="tarjeta foto-item">
      <div class="tarjeta-cabeza">
        <h3>{{ titulo() }}</h3>
        <span class="chip chip-{{ f.estado }}">{{ etiquetaEstado() }}</span>
      </div>
      @if (url()) {
        <img class="miniatura" [src]="url()" [alt]="'Foto: ' + titulo()" loading="lazy" />
      }
      @if (mostrarResumen()) {
        <p class="foto-linea">{{ f.resumen }}</p>
      }
      <p class="foto-linea texto-suave">
        <span [title]="fechaCompleta()">{{ cuando() }}</span>
        · {{ f.datos.ubicacion ? 'Con ubicación' : 'Sin ubicación' }}
        @if (f.datos.reporteId) {
          · Ligada a su reporte
        }
      </p>
      @if (f.datos.nota) {
        <p class="foto-nota">“{{ f.datos.nota }}”</p>
      }
      @if (f.mensaje) {
        <p class="alerta foto-aviso" [class.alerta-aviso]="f.estado === 'anulada'" [class.alerta-info]="f.estado !== 'anulada'">{{ f.mensaje }}</p>
      }
      @if (f.estado === 'pendiente' && f.error) {
        <p class="foto-linea texto-suave">Último intento: {{ f.error }}</p>
      }
      @if (f.estado === 'rechazada') {
        <p class="campo-error">{{ f.error }}</p>
      }
      @if (f.estado === 'anulada') {
        <p class="foto-linea texto-suave">La app no anula fotos. Si tiene dudas, llame a la oficina.</p>
      }
    </article>
  `,
  styles: `
    .foto-item h3 {
      font-size: 1.05rem;
    }
    .miniatura {
      display: block;
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      border-radius: var(--radio-boton);
      margin: var(--espacio-2) 0;
    }
    .foto-linea {
      margin: 0 0 4px;
    }
    .foto-nota {
      font-style: italic;
      margin: 6px 0 0;
    }
    .foto-aviso {
      margin: 8px 0 0;
    }
  `,
})
export class FotoItemComponent {
  readonly foto = input.required<EvidenciaLocal>();
  readonly mostrarResumen = input(true);

  protected readonly url = signal<string | null>(null);
  protected readonly titulo = computed(() => {
    const d = this.foto().datos;
    return d.tipo === 'Otro' && d.descripcion ? `Otro: ${d.descripcion}` : textoEvidencia(d.tipo);
  });
  protected readonly etiquetaEstado = computed(() => ETIQUETA_ESTADO_FOTO[this.foto().estado]);
  protected readonly cuando = computed(() => cuandoNegocio(this.foto().creadoEn));
  protected readonly fechaCompleta = computed(() => fechaHoraNegocio(this.foto().creadoEn));
  /** Mientras la foto siga en el teléfono se ve su miniatura; ya recibida se ve en la galería del viaje. */
  private readonly bytes = computed(() => this.foto().foto);

  constructor() {
    effect(() => {
      const bytes = this.bytes();
      const tipo = this.foto().tipoContenido;
      liberarUrl(untracked(this.url));
      this.url.set(bytes ? urlDeImagen(new Blob([bytes], { type: tipo })) : null);
    });
    inject(DestroyRef).onDestroy(() => liberarUrl(this.url()));
  }
}
