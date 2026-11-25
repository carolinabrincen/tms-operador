import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Viaje } from '../../core/api/operador-api.modelos';
import { textoMotivo } from '../utils/estatus-viaje.util';
import { cuandoNegocio, fechaHoraNegocio } from '../utils/zona-negocio.util';

const toneladas = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** Datos del viaje para el operador. Nunca tarifas, ingresos, costos, utilidad ni pagos (no existen en el modelo). */
@Component({
  selector: 'app-datos-viaje',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = viaje();
    <dl class="datos">
      @if (v.tipo === 'cargado') {
        @if (!omitirTrayecto()) {
          <div><dt>Cliente</dt><dd>{{ v.cliente }}</dd></div>
          <div><dt>Origen</dt><dd>{{ v.origen }}</dd></div>
          <div><dt>Destino</dt><dd>{{ v.destino }}</dd></div>
          <div><dt>Cita de carga</dt><dd [title]="fechaHora(v.citaCarga)">{{ cuando(v.citaCarga) || 'Sin cita' }}</dd></div>
          <div><dt>Cita de descarga</dt><dd [title]="fechaHora(v.citaDescarga)">{{ cuando(v.citaDescarga) || 'Sin cita' }}</dd></div>
          <div><dt>Producto</dt><dd>{{ v.producto }}</dd></div>
        }
        <div><dt>Toneladas programadas</dt><dd>{{ tons() }}</dd></div>
        <div><dt>Referencia</dt><dd>{{ v.referencia || 'Sin referencia' }}</dd></div>
      } @else {
        @for (t of tramos(); track t.orden) {
          <div>
            <dt>Tramo {{ t.orden }} · {{ motivo(t.motivo) }}</dt>
            <dd>{{ t.origen }} → {{ t.destino }}</dd>
          </div>
        }
      }
      @if (v.notas) {
        <div><dt>Notas</dt><dd>{{ v.notas }}</dd></div>
      }
      <div><dt>Folio del viaje</dt><dd>{{ v.folio }}</dd></div>
    </dl>
  `,
})
export class DatosViajeComponent {
  readonly viaje = input.required<Viaje>();
  /** true = cliente, origen, destino, citas y producto ya se ven en la tarjeta de trayecto: no se repiten. */
  readonly omitirTrayecto = input(false);
  protected readonly cuando = (iso: string | null) => cuandoNegocio(iso);
  protected readonly fechaHora = fechaHoraNegocio;
  protected readonly motivo = textoMotivo;
  protected readonly tons = computed(() => {
    const v = this.viaje();
    return v.tipo === 'cargado' && v.toneladasProgramadas != null ? `${toneladas.format(v.toneladasProgramadas)} t` : 'Sin dato';
  });
  protected readonly tramos = computed(() => {
    const v = this.viaje();
    return v.tipo === 'vacio' ? [...v.tramos].sort((a, b) => a.orden - b.orden) : [];
  });
}
