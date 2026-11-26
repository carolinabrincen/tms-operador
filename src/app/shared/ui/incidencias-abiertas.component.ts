import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PuntoGps, Salida } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { RELOJ } from '../../core/plataforma';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { UbicacionService } from '../../core/ubicacion/ubicacion.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { ETIQUETA_ESTADO_REPORTE } from '../utils/cola-reportes.util';
import { TarjetaIncidencia, tarjetasIncidencias, textoDesde } from '../utils/incidencias-abiertas.util';
import { LARGO_NOTA, textoIncidencia } from '../utils/incidencias.util';
import { ESPERA_GPS_MS, EXPLICACION_UBICACION, EstadoPermisoUbicacion, textoUbicacionEnReporte } from '../utils/ubicacion.util';
import { ahoraIsoUtc } from '../utils/zona-negocio.util';

const ESPERA_GPS_CON_PREGUNTA_MS = 20_000;

interface Confirmando {
  tarjeta: TarjetaIncidencia;
  terminadaEn: string;
  permiso: EstadoPermisoUbicacion;
  explicar: boolean;
}

/**
 * Incidencias abiertas de la salida (contrato M1, sección 2), también las que registró la oficina: una tarjeta ámbar
 * por cada una, con "Ya continué" (sección 7). El término va por la cola del teléfono, como los reportes. No bloquea
 * nada: si el operador reporta su siguiente paso, el servidor las termina solas.
 */
@Component({
  selector: 'app-incidencias-abiertas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tarjetas().length) {
      <section class="incidencias" aria-label="Incidencias abiertas">
        @for (t of tarjetas(); track t.clave) {
          <article class="tarjeta-incidencia" [class.en-cola]="t.estado !== 'abierta'">
            <div class="cabeza">
              <svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.5 20h19L12 4zM12 10v4.5M12 17.2v.1" /></svg>
              <h3 class="tipo">{{ texto(t.tipo) }}</h3>
              @if (t.estado === 'termino-pendiente') {
                <span class="chip chip-pendiente">Pendiente de enviar</span>
              } @else if (t.estado === 'incidencia-pendiente') {
                <span class="chip chip-{{ t.estadoReporte }}">{{ etiqueta(t.estadoReporte) }}</span>
              }
            </div>
            <p class="desde">{{ desde(t.ocurrioEn) }}</p>
            @if (t.nota) {
              <p class="nota">“{{ t.nota }}”</p>
            }
            @if (t.error) {
              <p class="campo-error" role="alert">{{ t.error }}</p>
            }
            @if (t.estado === 'abierta') {
              <button type="button" class="btn btn-primario btn-bloque btn-grande ya-continue" (click)="pedir(t)">
                Ya continué<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            } @else if (t.estado === 'termino-pendiente') {
              <p class="texto-suave aclaracion">Se enviará solo en cuanto haya señal.</p>
            } @else {
              <p class="texto-suave aclaracion">Podrá marcar “Ya continué” en cuanto la oficina la reciba.</p>
            }
          </article>
        }
      </section>
    }

    @if (confirmando(); as c) {
      <div class="velo" (click)="cancelar()">
        <section class="hoja" role="dialog" aria-modal="true" aria-labelledby="titulo-ya-continue" (click)="$event.stopPropagation()">
          <h2 id="titulo-ya-continue">¿Ya continuó?</h2>
          <p>
            <strong>{{ texto(c.tarjeta.tipo) }}</strong>, {{ desde(c.tarjeta.ocurrioEn) }}. Se avisa a la oficina que ya siguió su
            camino.
          </p>
          <div class="campo">
            <label for="nota-ya-continue">Nota (opcional)</label>
            <textarea id="nota-ya-continue" rows="3" [attr.maxlength]="LARGO_NOTA" [value]="nota()" (input)="escribirNota($event)"></textarea>
          </div>
          @if (c.explicar) {
            <p class="alerta alerta-info"><strong>Ubicación.</strong> {{ EXPLICACION }}</p>
          }
          <p class="texto-suave">{{ textoUbicacion(c.permiso) }}</p>
          @if (buscandoUbicacion()) {
            <p class="alerta alerta-info" role="status">Buscando su ubicación…</p>
            <button type="button" class="btn btn-secundario btn-bloque" (click)="sinUbicacion()">Enviar sin ubicación</button>
          } @else {
            <div class="acciones">
              <button type="button" class="btn btn-primario btn-bloque confirmar" [class.btn-ocupado]="guardando()" (click)="confirmar()">
                {{ guardando() ? 'Guardando…' : 'Sí, ya continué' }}
              </button>
              <button type="button" class="btn btn-secundario btn-bloque" (click)="cancelar()">Cancelar</button>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .incidencias {
      display: grid;
      gap: var(--espacio-3);
      margin: var(--espacio-4) 0 0;
    }
    .tarjeta-incidencia {
      padding: var(--espacio-4);
      border: 1px solid var(--c-aviso-borde);
      border-radius: var(--radio-tarjeta);
      background: var(--c-aviso-fondo);
      color: var(--c-aviso-texto);
    }
    .cabeza {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--espacio-2);
    }
    .icono {
      flex: none;
      width: 24px;
      height: 24px;
      fill: none;
      stroke: var(--c-aviso-icono);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .tipo {
      flex: 1;
      margin: 0;
      font-size: 1.05rem;
      color: var(--c-aviso-texto);
    }
    .desde {
      margin: var(--espacio-1) 0 0;
      font-weight: var(--peso-medio);
    }
    .nota {
      margin: var(--espacio-1) 0 0;
      font-style: italic;
    }
    .campo-error {
      margin-top: var(--espacio-2);
    }
    .ya-continue {
      margin-top: var(--espacio-3);
    }
    .aclaracion {
      margin: var(--espacio-2) 0 0;
      font-size: var(--texto-chico);
      color: var(--c-aviso-texto);
    }
  `,
})
export class IncidenciasAbiertasComponent {
  readonly salida = input.required<Salida | null>();

  private readonly cola = inject(ColaReportesService);
  private readonly asignacion = inject(AsignacionService);
  private readonly ubicacion = inject(UbicacionService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);
  private readonly reloj = inject(RELOJ);

  protected readonly LARGO_NOTA = LARGO_NOTA;
  protected readonly EXPLICACION = EXPLICACION_UBICACION;
  protected readonly texto = textoIncidencia;
  protected readonly textoUbicacion = textoUbicacionEnReporte;
  protected readonly desde = (iso: string) => textoDesde(iso, this.reloj());
  protected readonly etiqueta = (estado: string | null) => (estado ? (ETIQUETA_ESTADO_REPORTE as Record<string, string>)[estado] ?? '' : '');

  protected readonly tarjetas = computed(() => tarjetasIncidencias(this.salida(), this.cola.reportes(), this.asignacion.actualizadaEn()));
  protected readonly confirmando = signal<Confirmando | null>(null);
  protected readonly nota = signal('');
  protected readonly guardando = signal(false);
  protected readonly buscandoUbicacion = signal(false);
  private omitirUbicacion: (() => void) | null = null;

  protected async pedir(t: TarjetaIncidencia): Promise<void> {
    if (this.guardando()) return;
    const terminadaEn = ahoraIsoUtc(this.reloj());
    const permiso = await this.ubicacion.estadoPermiso();
    const explicar = await this.ubicacion.necesitaExplicacion();
    this.nota.set('');
    this.confirmando.set({ tarjeta: t, terminadaEn, permiso, explicar });
  }

  protected escribirNota(evento: Event): void {
    this.nota.set((evento.target as HTMLTextAreaElement).value.slice(0, LARGO_NOTA));
  }

  protected sinUbicacion(): void {
    this.omitirUbicacion?.();
  }

  protected cancelar(): void {
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando su aviso.');
      return;
    }
    this.confirmando.set(null);
  }

  protected async confirmar(): Promise<void> {
    const c = this.confirmando();
    if (!c?.tarjeta.incidenciaId || this.guardando()) return;
    this.guardando.set(true);
    try {
      if (c.explicar) this.ubicacion.marcarExplicada();
      const ubicacion = await this.puntoSinBloquear(c.permiso);
      await this.cola.registrar({
        tipo: 'termino',
        incidenciaId: c.tarjeta.incidenciaId,
        terminadaEn: c.terminadaEn,
        ubicacion,
        nota: this.nota(),
        resumen: `${textoIncidencia(c.tarjeta.tipo)}, ${textoDesde(c.tarjeta.ocurrioEn, this.reloj())}`,
      });
      this.confirmando.set(null);
      this.mensajes.mostrar(
        this.conexion.enLinea() ? '“Ya continué” guardado. Enviando a la oficina…' : '“Ya continué” guardado en el teléfono. Se enviará solo cuando vuelva la señal.',
        'exito',
      );
    } catch {
      this.mensajes.mostrar('No se pudo guardar el aviso en el teléfono. Intente de nuevo.', 'error', 8000);
    } finally {
      this.guardando.set(false);
      this.buscandoUbicacion.set(false);
      this.omitirUbicacion = null;
    }
  }

  /** Igual que en los reportes: sin permiso, sin GPS, si tarda o si el operador no quiere esperar, sigue sin punto. */
  private async puntoSinBloquear(permiso: EstadoPermisoUbicacion): Promise<PuntoGps | null> {
    if (permiso === 'negado' || permiso === 'no-disponible') return null;
    this.buscandoUbicacion.set(true);
    const omitida = new Promise<null>((resolver) => (this.omitirUbicacion = () => resolver(null)));
    try {
      return await Promise.race([this.ubicacion.obtenerPunto(permiso === 'concedido' ? ESPERA_GPS_MS : ESPERA_GPS_CON_PREGUNTA_MS), omitida]);
    } finally {
      this.buscandoUbicacion.set(false);
    }
  }
}
