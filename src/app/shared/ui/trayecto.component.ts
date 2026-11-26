import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RELOJ } from '../../core/plataforma';
import { Viaje } from '../../core/api/operador-api.modelos';
import { origenDestino, textoMotivo } from '../utils/estatus-viaje.util';
import { fechaHoraNegocio } from '../utils/zona-negocio.util';

/**
 * Origen y destino con sus fechas, unidos por una línea (referencia aprobada): lugar en 17 px y la fecha en 14 px. Va
 * dentro de una tarjeta; la pantalla agrega abajo sus renglones (hoja de ruta, detalle).
 */
@Component({
  selector: 'app-trayecto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trayecto">
      <div class="guia" aria-hidden="true">
        <span class="inicio"></span>
        <span class="union"></span>
        <span class="fin"></span>
      </div>
      <div class="lugares">
        <div class="lugar origen">
          <span class="oculto-visual">Origen: </span>
          <span class="nombre">{{ ruta().origen }}</span>{{ ' ' }}
          @if (lineaOrigen()) {
            <span class="detalle">{{ lineaOrigen() }}</span>
          }
        </div>
        <div class="lugar destino">
          <span class="oculto-visual">Destino: </span>
          <span class="nombre">{{ ruta().destino }}</span>{{ ' ' }}
          @if (lineaDestino()) {
            <span class="detalle">{{ lineaDestino() }}</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .trayecto {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
    }
    .guia {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 6px;
    }
    .inicio {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 2.5px solid var(--c-texto);
    }
    .union {
      flex: 1;
      width: 2px;
      margin: 3px 0;
      background: var(--c-linea-trayecto);
    }
    .fin {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: var(--c-texto);
    }
    .lugares {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }
    .lugar {
      display: flex;
      flex-direction: column;
    }
    .nombre {
      font-size: var(--texto-dato);
      font-weight: 700;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    .detalle {
      font-size: var(--texto-chico);
      color: var(--c-texto-suave);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class TrayectoComponent {
  readonly viaje = input.required<Viaje>();
  private readonly reloj = inject(RELOJ);
  protected readonly ruta = computed(() => origenDestino(this.viaje()));
  protected readonly lineaOrigen = computed(() => {
    const v = this.viaje();
    if (v.tipo === 'cargado') return `Carga: ${fechaHoraNegocio(v.citaCarga, undefined, this.reloj()) || 'sin cita'}`;
    const primero = [...v.tramos].sort((a, b) => a.orden - b.orden)[0];
    return primero ? `Viaje vacío · ${textoMotivo(primero.motivo)}` : 'Viaje vacío';
  });
  protected readonly lineaDestino = computed(() => {
    const v = this.viaje();
    if (v.tipo === 'cargado') return `Cita de descarga: ${fechaHoraNegocio(v.citaDescarga, undefined, this.reloj()) || 'sin cita'}`;
    return v.tramos.length > 1 ? `${v.tramos.length} tramos (vea el detalle)` : '';
  });
}
