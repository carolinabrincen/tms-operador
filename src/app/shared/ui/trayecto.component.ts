import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Viaje } from '../../core/api/operador-api.modelos';
import { origenDestino } from '../utils/estatus-viaje.util';
import { cuandoNegocio, fechaHoraNegocio } from '../utils/zona-negocio.util';

/**
 * "Sale de" y "Llega a", cada uno con su icono, separados por una línea fina. En viajes cargados, también cliente,
 * citas y producto. Va dentro de una tarjeta (en Mi viaje, montada sobre el encabezado).
 */
@Component({
  selector: 'app-trayecto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = viaje();
    <div class="punto origen">
      <svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" /><circle class="relleno" cx="12" cy="12" r="2.5" /></svg>
      <div>
        <span class="etiqueta-seccion">Sale de</span>
        <p class="lugar">{{ ruta().origen }}</p>
      </div>
    </div>
    <div class="punto destino">
      <svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
      <div>
        <span class="etiqueta-seccion">Llega a</span>
        <p class="lugar">{{ ruta().destino }}</p>
      </div>
    </div>
    @if (v.tipo === 'cargado') {
      <dl class="datos extras">
        <div><dt>Cliente</dt><dd>{{ v.cliente }}</dd></div>
        <div class="citas">
          <dt>Citas</dt>
          <dd>
            <span [title]="fechaHora(v.citaCarga)">Carga: {{ cuando(v.citaCarga) || 'Sin cita' }}</span><br />
            <span [title]="fechaHora(v.citaDescarga)">Descarga: {{ cuando(v.citaDescarga) || 'Sin cita' }}</span>
          </dd>
        </div>
        <div><dt>Producto</dt><dd>{{ v.producto }}</dd></div>
      </dl>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .punto {
      display: flex;
      align-items: flex-start;
      gap: var(--espacio-3);
    }
    .punto + .punto {
      margin-top: var(--espacio-3);
      padding-top: var(--espacio-3);
      border-top: 1px solid var(--c-borde);
    }
    .icono {
      flex: none;
      width: 36px;
      height: 36px;
      padding: 7px;
      border-radius: var(--radio-pildora);
      background: var(--c-primario-suave);
      fill: none;
      stroke: var(--c-primario);
      stroke-width: 2;
    }
    .icono .relleno {
      fill: var(--c-primario);
      stroke: none;
    }
    .etiqueta-seccion {
      display: block;
    }
    .lugar {
      margin: 0;
      font-size: 1.05rem;
      font-weight: var(--peso-titulo);
    }
    .extras {
      margin-top: var(--espacio-3);
      padding-top: var(--espacio-3);
      border-top: 1px solid var(--c-borde);
    }
  `,
})
export class TrayectoComponent {
  readonly viaje = input.required<Viaje>();
  protected readonly ruta = computed(() => origenDestino(this.viaje()));
  protected readonly cuando = (iso: string | null) => cuandoNegocio(iso);
  protected readonly fechaHora = fechaHoraNegocio;
}
