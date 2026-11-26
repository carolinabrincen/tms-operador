import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OPERADOR_API } from '../../core/api/operador-api';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { AlmacenSesion } from '../../core/sesion/almacen-sesion';
import { SalidaService } from '../../core/sesion/salida.service';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';

/** Mi cuenta: nombre y celular, "Gastos, próximamente" y "Salir" (con confirmación en una hoja). Ruta /cuenta. */
@Component({
  selector: 'app-cuenta',
  imports: [EncabezadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-encabezado titulo="Mi cuenta" />
    <main class="pagina">
      @if (sesion(); as s) {
        <section class="tarjeta cuenta-datos" aria-label="Sus datos">
          <dl class="datos">
            <div>
              <dt>Nombre</dt>
              <dd class="nombre">{{ s.nombre || 'Sin nombre' }}</dd>
            </div>
            <div>
              <dt>Celular</dt>
              <dd class="celular">{{ s.celularTerminacion ? 'Termina en ' + s.celularTerminacion : 'Sin dato' }}</dd>
            </div>
          </dl>
        </section>
      }

      <section class="tarjeta renglones" aria-label="Más funciones">
        <button type="button" class="renglon gastos" (click)="gastos()">
          <span class="renglon-textos">
            <span class="renglon-titulo">Gastos</span>
            <span class="renglon-detalle">Próximamente</span>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" /><path d="M4 10h16" /><path d="M7 15h4" /></svg>
        </button>
      </section>

      @if (esEjemplo) {
        <p class="alerta alerta-aviso">Está usando datos de ejemplo: no son viajes reales ni llegan a la oficina.</p>
      }

      <div class="acciones">
        <button type="button" class="btn btn-secundario btn-bloque salir" [disabled]="salida.saliendo()" (click)="salida.pedir()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></svg>
          {{ salida.saliendo() ? 'Saliendo…' : 'Salir' }}
        </button>
      </div>
      <p class="texto-suave nota-salir">Para volver a entrar necesitará su celular y su PIN.</p>
    </main>
  `,
  styles: `
    .nombre {
      font-size: var(--texto-dato);
    }
    .renglones {
      padding: 0;
    }
    .renglon {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      min-height: 60px;
      padding: 8px 16px;
      border: 0;
      border-radius: var(--radio-tarjeta);
      background: transparent;
      color: var(--c-texto);
      text-align: left;
    }
    .renglon-textos {
      display: flex;
      flex-direction: column;
    }
    .renglon-titulo {
      font-size: var(--texto-normal);
      font-weight: 700;
    }
    .renglon-detalle {
      font-size: var(--texto-chico);
      color: var(--c-texto-suave);
    }
    .renglon svg {
      flex: none;
      width: 22px;
      height: 22px;
      fill: none;
      stroke: var(--c-texto-suave);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .salir {
      min-height: var(--alto-boton-medio);
      font-size: var(--texto-dato);
    }
    .nota-salir {
      margin-top: var(--espacio-2);
      font-size: var(--texto-chico);
      text-align: center;
    }
  `,
})
export class CuentaPage {
  protected readonly sesion = inject(AlmacenSesion).sesion;
  protected readonly salida = inject(SalidaService);
  protected readonly esEjemplo = inject(OPERADOR_API).esEjemplo;
  private readonly mensajes = inject(MensajesService);

  protected gastos(): void {
    this.mensajes.mostrar('Gastos: próximamente. Esta función todavía no está disponible.', 'info');
  }
}
