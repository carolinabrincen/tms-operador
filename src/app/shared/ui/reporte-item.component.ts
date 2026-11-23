import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReporteLocal } from '../../core/reportes/reporte-local';
import { ETIQUETA_ESTADO_REPORTE } from '../utils/cola-reportes.util';
import { ETIQUETA_AVANCE } from '../utils/avances.util';
import { cuandoNegocio, fechaHoraNegocio } from '../utils/zona-negocio.util';

/** Un reporte con su estado: pendiente de enviar, enviado, confirmado por oficina (o no aceptado). */
@Component({
  selector: 'app-reporte-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = reporte();
    <article class="tarjeta reporte">
      <div class="tarjeta-cabeza">
        <h3>{{ etiquetaAvance() }}</h3>
        <span class="chip chip-{{ r.estado }}">{{ etiquetaEstado() }}</span>
      </div>
      @if (mostrarResumen()) {
        <p class="reporte-resumen">{{ r.resumen }}</p>
      }
      <p class="reporte-linea">
        <span [title]="fechaCompleta()">{{ cuando() }}</span>
        · {{ r.reporte.ubicacion ? 'Con ubicación' : 'Sin ubicación' }}
      </p>
      @if (r.reporte.nota) {
        <p class="reporte-nota">“{{ r.reporte.nota }}”</p>
      }
      @if (r.estado === 'pendiente' && r.error) {
        <p class="reporte-linea texto-suave">Último intento: {{ r.error }}</p>
      }
      @if (r.estado === 'rechazado') {
        <p class="campo-error">{{ r.error }} Avise a la oficina.</p>
      }
    </article>
  `,
  styles: `
    .reporte h3 {
      font-size: 1.15rem;
    }
    .reporte-resumen {
      font-weight: 600;
    }
    .reporte-linea {
      margin: 0 0 4px;
    }
    .reporte-nota {
      font-style: italic;
      margin: 6px 0 0;
    }
  `,
})
export class ReporteItemComponent {
  readonly reporte = input.required<ReporteLocal>();
  readonly mostrarResumen = input(true);

  protected readonly etiquetaAvance = computed(() => ETIQUETA_AVANCE[this.reporte().reporte.avance]);
  protected readonly etiquetaEstado = computed(() => ETIQUETA_ESTADO_REPORTE[this.reporte().estado]);
  protected readonly cuando = computed(() => cuandoNegocio(this.reporte().reporte.ocurrioEn));
  protected readonly fechaCompleta = computed(() => fechaHoraNegocio(this.reporte().reporte.ocurrioEn));
}
