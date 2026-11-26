import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConexionService } from '../../core/conexion/conexion.service';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { RelojTelefonoService } from '../../core/reloj/reloj-telefono.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AlmacenSesion } from '../../core/sesion/almacen-sesion';
import { estadoSenal, nombreCorto } from '../utils/encabezado.util';
import { ligaTelefono } from '../utils/hoja-ruta.util';

/**
 * Encabezado de cada pantalla (referencia aprobada el 26/11/2026):
 *  - principal (Mi viaje): nombre corto y unidad; debajo, el estado real de la cola ("Con señal · todo enviado",
 *    "Enviando…", "Sin señal · 2 por enviar"); a la derecha "Tráfico", que llama al teléfono de tráfico de la hoja de
 *    ruta guardada, o al de la empresa; sin ninguno, no se muestra.
 *  - secundario: flecha de regreso (si hay a dónde), título de 24 px y una línea secundaria opcional.
 * En ambos, el aviso de la hora del teléfono mal puesta.
 */
@Component({
  selector: 'app-encabezado',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'encabezado', '[class.encabezado-principal]': 'principal()' },
  template: `
    @if (principal()) {
      <header class="barra">
        <div class="quien">
          <span class="nombre">{{ nombre() }}{{ unidad() ? ' · ' + unidad() : '' }}</span>
          @let s = senal();
          @if (porEnviar() > 0) {
            <a routerLink="/reportes" class="senal {{ s.clase }}" aria-live="polite"><span class="punto" aria-hidden="true"></span>{{ s.texto }}</a>
          } @else {
            <span class="senal {{ s.clase }}" aria-live="polite"><span class="punto" aria-hidden="true"></span>{{ s.texto }}</span>
          }
        </div>
        @if (telefono(); as t) {
          <a class="btn btn-secundario trafico" [href]="t" [attr.aria-label]="'Llamar a ' + (esTrafico() ? 'tráfico' : 'la oficina')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
            {{ esTrafico() ? 'Tráfico' : 'Oficina' }}
          </a>
        }
      </header>
    } @else {
      <header class="barra barra-secundaria">
        @if (volver(); as ruta) {
          <a class="volver" [routerLink]="ruta" [attr.aria-label]="'Regresar a ' + textoVolver()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </a>
        }
        <div class="titulos">
          <h1 class="titulo">{{ titulo() }}</h1>
          @if (subtitulo()) {
            <p class="subtitulo">{{ subtitulo() }}</p>
          }
        </div>
      </header>
    }
    @if (avisoReloj()) {
      <p class="alerta alerta-error aviso-reloj" role="alert">{{ avisoReloj() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: var(--espacio-4) var(--margen-lado) 0;
    }
    .barra {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .quien {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .nombre {
      overflow: hidden;
      font-size: var(--texto-normal);
      font-weight: 700;
      line-height: 1.3;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .senal {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--texto-chico);
      font-weight: 600;
      text-decoration: none;
    }
    .punto {
      flex: none;
      width: 9px;
      height: 9px;
      border-radius: 50%;
    }
    .con-senal,
    .enviando {
      color: var(--c-senal);
    }
    .con-senal .punto,
    .enviando .punto {
      background: var(--c-senal-punto);
    }
    /* Sin señal: también cambia la forma (cuadro), no solo el color. */
    .sin-senal {
      color: var(--c-sin-senal);
    }
    .sin-senal .punto {
      border-radius: 2px;
      background: var(--c-sin-senal-punto);
    }
    @media (prefers-reduced-motion: no-preference) {
      .enviando .punto {
        animation: latido 1s ease-in-out infinite alternate;
      }
    }
    @keyframes latido {
      to {
        opacity: 0.35;
      }
    }
    .trafico {
      flex: none;
      padding: 0 14px;
      font-size: var(--texto-boton);
    }
    .barra-secundaria {
      justify-content: flex-start;
      gap: var(--espacio-3);
    }
    .volver {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--alto-boton);
      height: var(--alto-boton);
      border: 1px solid var(--c-borde);
      border-radius: var(--radio-boton);
      background: var(--c-superficie);
      color: var(--c-texto);
    }
    .volver svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .titulos {
      min-width: 0;
    }
    .titulo {
      margin: 0;
      font-size: var(--texto-titulo);
      line-height: 1.2;
    }
    .subtitulo {
      margin: 0;
      font-size: var(--texto-chico);
      color: var(--c-texto-suave);
      font-variant-numeric: tabular-nums;
    }
    .aviso-reloj {
      margin: var(--espacio-3) 0 0;
    }
  `,
})
export class EncabezadoComponent {
  readonly titulo = input<string | null>(null);
  readonly subtitulo = input<string | null>(null);
  /** Ruta de la flecha de regreso; null = sin flecha. */
  readonly volver = input<string | null>(null);
  readonly textoVolver = input('Mi viaje');
  /** Mi viaje: barra con nombre, unidad, señal y "Tráfico". */
  readonly principal = input(false);
  /** Número económico de la unidad (solo principal). */
  readonly unidad = input<string | null>(null);

  private readonly sesion = inject(AlmacenSesion).sesion;
  private readonly enLinea = inject(ConexionService).enLinea;
  private readonly cola = inject(ColaReportesService);
  private readonly fotos = inject(ColaEvidenciasService);
  private readonly hoja = inject(HojaRutaService).hojaRuta;
  /** Hora del teléfono mal puesta: el servidor rechaza reportes con más de 10 minutos en el futuro. */
  protected readonly avisoReloj = inject(RelojTelefonoService).aviso;

  protected readonly nombre = computed(() => nombreCorto(this.sesion()?.nombre));
  protected readonly porEnviar = computed(() => this.cola.pendientes() + this.fotos.pendientes());
  protected readonly senal = computed(() => estadoSenal(this.enLinea(), this.porEnviar(), this.cola.enviando() || this.fotos.enviando()));
  /** Tráfico de la hoja de ruta guardada; si no hay, el de la empresa. */
  protected readonly esTrafico = computed(() => !!ligaTelefono(this.hoja()?.telefonoTrafico));
  protected readonly telefono = computed(() => ligaTelefono(this.hoja()?.telefonoTrafico) ?? ligaTelefono(this.hoja()?.telefonoEmpresa));
}
