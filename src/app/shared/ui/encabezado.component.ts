import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OPERADOR_API } from '../../core/api/operador-api';
import { ConexionService } from '../../core/conexion/conexion.service';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { RelojTelefonoService } from '../../core/reloj/reloj-telefono.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AlmacenSesion } from '../../core/sesion/almacen-sesion';
import { SalidaService } from '../../core/sesion/salida.service';
import { textoPendientes } from '../utils/cola-reportes.util';
import { textoFotosPendientes } from '../utils/evidencias.util';

/**
 * Encabezado azul de cada pantalla, de todo el ancho de la columna y con las esquinas inferiores redondeadas.
 *  - principal (Mi viaje): alto; lo de adentro (viaje, estatus en grande, barra de avance) lo pone la pantalla.
 *  - secundario: más bajo, con la flecha de regreso y el título.
 * Lleva "Salir" (con sesión) y la píldora "Datos de ejemplo". Debajo, dentro del azul, los avisos de la app: sin
 * conexión, reportes y fotos pendientes, y la hora del teléfono mal puesta.
 */
@Component({
  selector: 'app-encabezado',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'encabezado', '[class.encabezado-principal]': 'principal()' },
  template: `
    <header class="enc">
      <div class="enc-fila">
        @if (volver(); as ruta) {
          <a class="enc-volver" [routerLink]="ruta" [attr.aria-label]="'Regresar a ' + textoVolver()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </a>
        }
        <div class="enc-titulo-bloque">
          @if (titulo()) {
            <h1 class="enc-titulo">{{ titulo() }}</h1>
          }
          <ng-content select="[enc-arriba]" />
        </div>
        @if (sesion()) {
          <button type="button" class="enc-salir cabecera-salir" [disabled]="salida.saliendo()" (click)="salida.pedir()">
            {{ salida.saliendo() ? 'Saliendo…' : 'Salir' }}
          </button>
        }
      </div>
      @if (esEjemplo) {
        <span class="aviso-ejemplo" role="note">Datos de ejemplo</span>
      }
      <ng-content />

      @if (sesion()) {
        <div class="estado" aria-live="polite">
          @if (!enLinea()) {
            <p class="estado-linea estado-sin-conexion" role="status">
              <strong>Sin conexión.</strong> Sus reportes se guardan en el teléfono y se envían solos al volver la señal.
            </p>
          }
          @if (cola.pendientes() > 0) {
            <a routerLink="/reportes" class="estado-linea estado-pendientes">
              {{ textoPendientes(cola.pendientes()) }}{{ cola.enviando() ? ' · enviando…' : '' }}
            </a>
          }
          @if (fotos.pendientes() > 0) {
            <a routerLink="/evidencias" class="estado-linea estado-pendientes estado-fotos">
              {{ fotos.avisoAcumuladas() ?? textoFotosPendientes(fotos.pendientes()) }}{{ fotos.enviando() ? ' · enviando…' : '' }}
            </a>
          }
        </div>
      }
      @if (avisoReloj()) {
        <p class="estado-linea estado-reloj" role="alert">{{ avisoReloj() }}</p>
      }
    </header>
  `,
  styles: `
    :host {
      display: block;
    }
    .enc {
      padding: calc(var(--seguro-arriba) + var(--espacio-3)) var(--espacio-4) var(--espacio-4);
      background: var(--c-primario);
      color: var(--c-sobre-primario);
      border-radius: 0 0 var(--radio-encabezado) var(--radio-encabezado);
    }
    /* Principal: más alto abajo para que la tarjeta del viaje se monte sobre su borde. */
    :host(.encabezado-principal) .enc {
      padding-bottom: calc(var(--espacio-8) + var(--espacio-6));
    }
    .enc-fila {
      display: flex;
      align-items: center;
      gap: var(--espacio-2);
      min-height: 44px;
    }
    .enc-titulo-bloque {
      flex: 1;
      min-width: 0;
    }
    .enc-titulo {
      margin: 0;
      font-size: var(--texto-titulo);
      font-weight: var(--peso-titulo);
      color: var(--c-sobre-primario);
    }
    .enc-volver {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 44px;
      height: 44px;
      margin-left: calc(-1 * var(--espacio-2));
      border-radius: var(--radio-pildora);
      color: var(--c-sobre-primario);
    }
    .enc-volver svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.25;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* "Salir": píldora chica con contorno; el área que se toca mide 48 px de alto. */
    .enc-salir {
      flex: none;
      position: relative;
      min-height: 32px;
      padding: 4px 14px;
      border: 1px solid var(--c-sobre-primario-borde);
      border-radius: var(--radio-pildora);
      background: transparent;
      color: var(--c-sobre-primario);
      font: inherit;
      font-size: var(--texto-chico);
      font-weight: var(--peso-medio);
      cursor: pointer;
    }
    .enc-salir::after {
      content: '';
      position: absolute;
      inset: -8px -4px;
    }
    .enc-salir:disabled {
      opacity: 0.8;
      cursor: default;
    }
    .aviso-ejemplo {
      display: inline-block;
      margin-top: var(--espacio-1);
      padding: 2px 10px;
      border-radius: var(--radio-pildora);
      background: var(--c-aviso-fondo);
      color: var(--c-aviso-texto);
      font-size: var(--texto-chico);
      font-weight: var(--peso-medio);
      white-space: nowrap;
    }
    .estado {
      display: grid;
      gap: var(--espacio-2);
    }
    .estado:empty {
      display: none;
    }
    .estado,
    .estado-reloj {
      margin-top: var(--espacio-3);
    }
    .estado-linea {
      display: block;
      margin: 0;
      padding: var(--espacio-2) var(--espacio-3);
      border-radius: var(--radio-boton);
      font-size: var(--texto-chico);
      font-weight: var(--peso-medio);
    }
    .estado-sin-conexion {
      background: var(--c-texto);
      color: #fff;
    }
    .estado-pendientes {
      background: var(--c-aviso-fondo);
      color: var(--c-aviso-texto);
      text-decoration: underline;
    }
    .estado-reloj {
      background: var(--c-error-fondo);
      color: var(--c-error-texto);
    }
  `,
})
export class EncabezadoComponent {
  /** Título (h1). En Mi viaje la pantalla pone el suyo con [enc-arriba]. */
  readonly titulo = input<string | null>(null);
  /** Ruta de la flecha de regreso; null = sin flecha. */
  readonly volver = input<string | null>(null);
  readonly textoVolver = input('Mi viaje');
  readonly principal = input(false);

  protected readonly salida = inject(SalidaService);
  protected readonly sesion = inject(AlmacenSesion).sesion;
  protected readonly esEjemplo = inject(OPERADOR_API).esEjemplo;
  protected readonly enLinea = inject(ConexionService).enLinea;
  protected readonly cola = inject(ColaReportesService);
  protected readonly fotos = inject(ColaEvidenciasService);
  /** Hora del teléfono mal puesta: el servidor rechaza reportes con más de 10 minutos en el futuro. */
  protected readonly avisoReloj = inject(RelojTelefonoService).aviso;
  protected readonly textoPendientes = textoPendientes;
  protected readonly textoFotosPendientes = textoFotosPendientes;
}
