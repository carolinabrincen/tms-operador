import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { EstatusViaje, PuntoGps, TipoIncidencia, Viaje } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { RELOJ } from '../../core/plataforma';
import { ColaReportesService, NuevoReporte } from '../../core/reportes/cola-reportes.service';
import { UbicacionService } from '../../core/ubicacion/ubicacion.service';
import { ETIQUETA_ESTATUS, ayudaPaso, esHito, guia, pasosDisponibles, pasosOperador, rango, textoBoton, tituloViaje, viajeTerminado } from '../utils/estatus-viaje.util';
import { admiteFotos, TEXTO_FOTO_CANCELADO } from '../utils/evidencias.util';
import { ETIQUETA_INCIDENCIA, INCIDENCIAS, LARGO_NOTA, mensajeIncidencia } from '../utils/incidencias.util';
import { ESPERA_GPS_MS, EXPLICACION_UBICACION, EstadoPermisoUbicacion, textoUbicacionEnReporte } from '../utils/ubicacion.util';
import { TEXTO_ZONA_NEGOCIO, ahoraIsoUtc, fechaHoraNegocio, horaNegocio } from '../utils/zona-negocio.util';
import { HojaFotoComponent } from './hoja-foto.component';

/** Si el teléfono va a preguntar por el permiso, se da más tiempo para que el operador lea y conteste. */
const ESPERA_GPS_CON_PREGUNTA_MS = 20_000;

/** Sin señal no es error: lo que se dice al guardar un reporte. */
export const TEXTO_GUARDADO_SIN_SENAL = 'Quedó guardado y se enviará solo cuando haya señal.';

type Borrador =
  | {
      tipo: 'estatus';
      estatus: EstatusViaje;
      saltados: EstatusViaje[];
      ocurrioEn: string;
      permiso: EstadoPermisoUbicacion;
      explicar: boolean;
      /** Vino del botón principal: también lleva el lapso para deshacer. */
      conLapso: boolean;
    }
  | { tipo: 'incidencia'; incidencia: TipoIncidencia | null; ocurrioEn: string; permiso: EstadoPermisoUbicacion; explicar: boolean };

/**
 * Acciones del operador sobre UN viaje (referencia aprobada):
 *  - Botón principal (72 px) con el siguiente paso en palabras del operador y una línea de ayuda arriba. Al tocarlo el
 *    reporte se GUARDA y espera el lapso para deshacer ("Guardado: «Ya cargué», 11:32 a. m." · Deshacer) antes de
 *    enviarse; la ubicación se agrega si llega durante el lapso. Solo la primera vez que hay que explicar la ubicación
 *    se abre la hoja de confirmación.
 *  - Fila de tres: Incidencia, Foto y Otro paso (los demás pasos hacia adelante, para saltar), en hojas inferiores.
 * Nunca espera al GPS más de lo debido.
 */
@Component({
  selector: 'app-panel-avance',
  imports: [HojaFotoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-avance.component.html',
  styleUrl: './panel-avance.component.scss',
})
export class PanelAvanceComponent {
  readonly viaje = input.required<Viaje>();

  private readonly cola = inject(ColaReportesService);
  private readonly ubicacion = inject(UbicacionService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);
  private readonly reloj = inject(RELOJ);

  protected readonly ETIQUETA_ESTATUS = ETIQUETA_ESTATUS;
  protected readonly ETIQUETA_INCIDENCIA = ETIQUETA_INCIDENCIA;
  protected readonly INCIDENCIAS = INCIDENCIAS;
  protected readonly EXPLICACION_UBICACION = EXPLICACION_UBICACION;
  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly LARGO_NOTA = LARGO_NOTA;
  protected readonly boton = textoBoton;
  protected readonly ayuda = ayudaPaso;
  protected readonly hora = (iso: string) => horaNegocio(iso);
  protected readonly esHito = esHito;
  protected readonly fechaHora = fechaHoraNegocio;
  protected readonly textoUbicacion = textoUbicacionEnReporte;

  protected readonly guia = computed(() => guia(this.viaje(), this.cola.reportes()));
  protected readonly pasos = computed(() => pasosDisponibles(this.viaje(), this.cola.reportes()));
  protected readonly siguiente = computed(() => this.pasos()[0] ?? null);
  protected readonly otros = computed(() => this.pasos().slice(1));
  /** Cerrado o cancelado: no se ofrecen reportes (ni de estatus ni de incidencia). */
  protected readonly terminado = computed(() => viajeTerminado(this.viaje()));
  protected readonly cancelado = computed(() => this.viaje().estatus === 'Cancelado');
  /** Último paso que reportó (para "Ya reportó …"). */
  protected readonly ultimoPaso = computed(() => {
    const v = this.viaje();
    const g = this.guia();
    return pasosOperador(v).find((e) => rango(v.tipo, e) === rango(v.tipo, g.estatus)) ?? null;
  });

  /** El reporte de estatus de este viaje que aún se puede deshacer (espera su lapso). */
  protected readonly retenido = computed(() => {
    const ids = new Set(this.cola.retenidos());
    const r = this.cola.reportes().find((x) => ids.has(x.id) && x.reporte.tipo === 'estatus' && x.reporte.viajeId === this.viaje().id);
    return r && r.reporte.tipo === 'estatus' ? { id: r.id, estatus: r.reporte.estatus, ocurrioEn: r.reporte.ocurrioEn } : null;
  });

  /** Hoja "Otro paso": los pasos hacia adelante que se pueden saltar. */
  protected readonly eligiendoPaso = signal(false);
  protected readonly fotoAbierta = signal(false);
  protected readonly borrador = signal<Borrador | null>(null);
  protected readonly nota = signal('');
  protected readonly intentoEnvio = signal(false);
  protected readonly guardando = signal(false);
  protected readonly buscandoUbicacion = signal(false);
  protected readonly errorIncidencia = computed(() => {
    const b = this.borrador();
    return b?.tipo === 'incidencia' ? mensajeIncidencia(b.incidencia, this.nota()) : null;
  });
  private omitirUbicacion: (() => void) | null = null;

  /** Botón principal: guarda de inmediato con lapso para deshacer (sin hoja, salvo la explicación de la ubicación). */
  protected async tocarPrincipal(estatus: EstatusViaje): Promise<void> {
    if (this.ocupado()) return;
    const ocurrioEn = ahoraIsoUtc(this.reloj());
    const { permiso, explicar } = await this.permisos();
    if (explicar) {
      this.abrir({ tipo: 'estatus', estatus, saltados: [], ocurrioEn, permiso, explicar, conLapso: true });
      return;
    }
    this.guardando.set(true);
    const v = this.viaje();
    try {
      const r = await this.cola.registrar(
        { tipo: 'estatus', estatus, viajeId: v.id, ocurrioEn, ubicacion: null, nota: null, resumen: tituloViaje(v) },
        { retener: true },
      );
      // La ubicación, si llega durante el lapso, se agrega; si no, se envía sin ella (nunca se bloquea).
      if (permiso !== 'negado' && permiso !== 'no-disponible') {
        void this.ubicacion
          .obtenerPunto(ESPERA_GPS_MS)
          .then((p) => (p ? this.cola.completarUbicacion(r.id, p) : undefined))
          .catch(() => undefined);
      }
    } catch {
      this.mensajes.mostrar('No se pudo guardar el reporte en el teléfono. Intente de nuevo; si sigue igual, llame a la oficina.', 'error', 8000);
    } finally {
      this.guardando.set(false);
    }
  }

  /** "Deshacer": lo cancela sin enviar nada. */
  protected async deshacer(id: string): Promise<void> {
    const r = this.retenido();
    if (await this.cola.deshacer(id)) {
      this.mensajes.mostrar(`Se canceló «${r ? textoBoton(r.estatus) : 'el reporte'}». No se envió nada.`, 'info', 4000);
    } else {
      this.mensajes.mostrar('Ya se envió a la oficina; ya no se puede deshacer. Si fue un error, llame a la oficina.', 'aviso', 8000);
    }
  }

  protected pedirOtroPaso(): void {
    if (!this.otros().length) {
      this.mensajes.mostrar('No hay otros pasos que reportar en este viaje.');
      return;
    }
    this.eligiendoPaso.set(true);
  }

  protected pedirFoto(): void {
    const v = this.viaje();
    if (!admiteFotos(v)) {
      this.mensajes.mostrar(v.tipo === 'vacio' ? 'Las fotos de evidencia son para viajes cargados; este viaje es vacío.' : TEXTO_FOTO_CANCELADO, 'aviso', 6000);
      return;
    }
    this.fotoAbierta.set(true);
  }

  protected async pedirEstatus(estatus: EstatusViaje): Promise<void> {
    if (this.ocupado()) return;
    const saltados = this.pasos().slice(0, this.pasos().indexOf(estatus));
    const ocurrioEn = ahoraIsoUtc(this.reloj());
    const { permiso, explicar } = await this.permisos();
    this.abrir({ tipo: 'estatus', estatus, saltados, ocurrioEn, permiso, explicar, conLapso: false });
  }

  protected elegirOtroPaso(estatus: EstatusViaje): void {
    this.eligiendoPaso.set(false);
    void this.pedirEstatus(estatus);
  }

  protected async pedirIncidencia(): Promise<void> {
    if (this.ocupado()) return;
    const ocurrioEn = ahoraIsoUtc(this.reloj());
    const { permiso, explicar } = await this.permisos();
    this.abrir({ tipo: 'incidencia', incidencia: null, ocurrioEn, permiso, explicar });
  }

  protected elegirIncidencia(tipo: TipoIncidencia): void {
    this.borrador.update((b) => (b?.tipo === 'incidencia' ? { ...b, incidencia: tipo } : b));
  }

  protected escribirNota(evento: Event): void {
    this.nota.set((evento.target as HTMLTextAreaElement).value.slice(0, LARGO_NOTA));
  }

  protected cancelar(): void {
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando su reporte.');
      return;
    }
    this.borrador.set(null);
  }

  /** "Enviar sin ubicación": deja de esperar al GPS. */
  protected sinUbicacion(): void {
    this.omitirUbicacion?.();
  }

  protected async confirmar(): Promise<void> {
    const b = this.borrador();
    if (!b) return;
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando su reporte.');
      return;
    }
    this.intentoEnvio.set(true);
    if (b.tipo === 'incidencia' && this.errorIncidencia()) return; // el mensaje queda visible en la hoja
    this.guardando.set(true);
    const v = this.viaje();
    try {
      if (b.explicar) this.ubicacion.marcarExplicada();
      const ubicacion = await this.puntoSinBloquear(b.permiso);
      const comun = { viajeId: v.id, ocurrioEn: b.ocurrioEn, ubicacion, nota: this.nota(), resumen: tituloViaje(v) };
      const nuevo: NuevoReporte =
        b.tipo === 'estatus' ? { ...comun, tipo: 'estatus', estatus: b.estatus } : { ...comun, tipo: 'incidencia', incidencia: b.incidencia! };
      const conLapso = b.tipo === 'estatus' && b.conLapso;
      await this.cola.registrar(nuevo, { retener: conLapso });
      this.borrador.set(null);
      if (!conLapso) {
        const que = b.tipo === 'estatus' ? `«${textoBoton(b.estatus)}»` : 'La incidencia';
        this.mensajes.mostrar(this.conexion.enLinea() ? `${que} quedó guardado. Enviando a la oficina…` : TEXTO_GUARDADO_SIN_SENAL, 'exito');
      }
    } catch {
      this.mensajes.mostrar('No se pudo guardar el reporte en el teléfono. Intente de nuevo; si sigue igual, llame a la oficina.', 'error', 8000);
    } finally {
      this.guardando.set(false);
      this.buscandoUbicacion.set(false);
      this.omitirUbicacion = null;
    }
  }

  private ocupado(): boolean {
    if (!this.guardando()) return false;
    this.mensajes.mostrar('Espere, se está guardando el reporte anterior.');
    return true;
  }

  private abrir(b: Borrador): void {
    this.nota.set('');
    this.intentoEnvio.set(false);
    this.borrador.set(b);
  }

  private async permisos(): Promise<{ permiso: EstadoPermisoUbicacion; explicar: boolean }> {
    return { permiso: await this.ubicacion.estadoPermiso(), explicar: await this.ubicacion.necesitaExplicacion() };
  }

  /** Nunca bloquea: sin permiso, sin GPS, si tarda o si el operador decide no esperar, sigue sin punto. */
  private async puntoSinBloquear(permiso: EstadoPermisoUbicacion): Promise<PuntoGps | null> {
    if (permiso === 'negado' || permiso === 'no-disponible') return null;
    this.buscandoUbicacion.set(true);
    const omitida = new Promise<null>((resolver) => (this.omitirUbicacion = () => resolver(null)));
    const espera = permiso === 'concedido' ? ESPERA_GPS_MS : ESPERA_GPS_CON_PREGUNTA_MS;
    try {
      return await Promise.race([this.ubicacion.obtenerPunto(espera), omitida]);
    } finally {
      this.buscandoUbicacion.set(false);
    }
  }
}
