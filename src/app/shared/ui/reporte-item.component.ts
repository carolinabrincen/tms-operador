import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReporteLocal } from '../../core/reportes/reporte-local';
import { ETIQUETA_ESTADO_REPORTE, horaDelEnvio } from '../utils/cola-reportes.util';
import { textoBoton, textoEstatus } from '../utils/estatus-viaje.util';
import { textoIncidencia } from '../utils/incidencias.util';
import { cuandoNegocio, fechaHoraNegocio } from '../utils/zona-negocio.util';

/** Un reporte (o un "Ya continué") con su estado: pendiente de enviar, enviado, pendiente de confirmar, confirmado o no aceptado. */
@Component({
  selector: 'app-reporte-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = reporte();
    <article class="tarjeta reporte">
      <div class="tarjeta-cabeza">
        <h3>{{ titulo() }}</h3>
        <span class="chip chip-{{ r.estado }}">{{ etiquetaEstado() }}</span>
      </div>
      @if (detalle()) {
        <p class="reporte-linea texto-suave">{{ detalle() }}</p>
      }
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
      @if (r.mensaje) {
        <p class="alerta reporte-aviso" [class.alerta-aviso]="avisoFuerte()" [class.alerta-info]="!avisoFuerte()">{{ r.mensaje }}</p>
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
      font-size: 1.05rem;
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
    .reporte-aviso {
      margin: 8px 0 0;
    }
  `,
})
export class ReporteItemComponent {
  readonly reporte = input.required<ReporteLocal>();
  readonly mostrarResumen = input(true);

  /** Lo que el operador tocó: "Me están cargando", "Incidencia: Falla mecánica" o "Ya continué". */
  protected readonly titulo = computed(() => {
    const r = this.reporte().reporte;
    if (r.tipo === 'termino') return 'Ya continué';
    return r.tipo === 'estatus' ? textoBoton(r.estatus) : `Incidencia: ${textoIncidencia(r.incidencia)}`;
  });
  /** Para estatus: a qué estatus lleva ("Estatus: Cargando"). */
  protected readonly detalle = computed(() => {
    const r = this.reporte().reporte;
    return r.tipo === 'estatus' ? `Estatus: ${textoEstatus(r.estatus)}` : null;
  });
  /** Sin efecto o descartado: el mensaje es un aviso (no contó). Si no, es informativo ("Recibido; la oficina lo confirma."). */
  protected readonly avisoFuerte = computed(() => this.reporte().estado === 'descartado' || this.reporte().resultado === 'sin-efecto');
  protected readonly etiquetaEstado = computed(() => ETIQUETA_ESTADO_REPORTE[this.reporte().estado]);
  protected readonly cuando = computed(() => cuandoNegocio(horaDelEnvio(this.reporte().reporte)));
  protected readonly fechaCompleta = computed(() => fechaHoraNegocio(horaDelEnvio(this.reporte().reporte)));
}
