import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { EstatusViaje, PuntoGps, TipoIncidencia, Viaje } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService, NuevoReporte } from '../../core/reportes/cola-reportes.service';
import { UbicacionService } from '../../core/ubicacion/ubicacion.service';
import { ETIQUETA_ESTADO_REPORTE } from '../utils/cola-reportes.util';
import { ETIQUETA_ESTATUS, esHito, guia, pasosDisponibles, pasosOperador, rango, textoBoton, tituloViaje } from '../utils/estatus-viaje.util';
import { ETIQUETA_INCIDENCIA, INCIDENCIAS, LARGO_NOTA, mensajeIncidencia } from '../utils/incidencias.util';
import { ESPERA_GPS_MS, EXPLICACION_UBICACION, EstadoPermisoUbicacion, textoUbicacionEnReporte } from '../utils/ubicacion.util';
import { TEXTO_ZONA_NEGOCIO, ahoraIsoUtc, fechaHoraNegocio } from '../utils/zona-negocio.util';
import { EstadoReporteLocal } from '../../core/reportes/reporte-local';

/** Si el teléfono va a preguntar por el permiso, se da más tiempo para que el operador lea y conteste. */
const ESPERA_GPS_CON_PREGUNTA_MS = 20_000;

type Borrador =
  | { tipo: 'estatus'; estatus: EstatusViaje; saltados: EstatusViaje[]; ocurrioEn: string; permiso: EstadoPermisoUbicacion; explicar: boolean }
  | { tipo: 'incidencia'; incidencia: TipoIncidencia | null; ocurrioEn: string; permiso: EstadoPermisoUbicacion; explicar: boolean };

/**
 * Acciones del operador sobre UN viaje: el siguiente paso (grande), los demás pasos hacia adelante (para saltar) y
 * "Reportar incidencia". Pide confirmar; guarda en la cola; nunca espera al GPS más de lo debido.
 */
@Component({
  selector: 'app-panel-avance',
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

  protected readonly ETIQUETA_ESTATUS = ETIQUETA_ESTATUS;
  protected readonly ETIQUETA_INCIDENCIA = ETIQUETA_INCIDENCIA;
  protected readonly INCIDENCIAS = INCIDENCIAS;
  protected readonly EXPLICACION_UBICACION = EXPLICACION_UBICACION;
  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly LARGO_NOTA = LARGO_NOTA;
  protected readonly boton = textoBoton;
  protected readonly esHito = esHito;
  protected readonly fechaHora = fechaHoraNegocio;
  protected readonly textoUbicacion = textoUbicacionEnReporte;

  protected readonly guia = computed(() => guia(this.viaje(), this.cola.reportes()));
  protected readonly pasos = computed(() => pasosDisponibles(this.viaje(), this.cola.reportes()));
  protected readonly siguiente = computed(() => this.pasos()[0] ?? null);
  protected readonly otros = computed(() => this.pasos().slice(1));
  protected readonly cerrado = computed(() => this.viaje().estatus === 'Cerrado');
  protected readonly marcaGuia = computed(() => {
    const g = this.guia();
    return g.porReporte && g.estadoReporte ? ETIQUETA_ESTADO_REPORTE[g.estadoReporte as EstadoReporteLocal] : null;
  });
  /** Último paso que reportó (para "Ya reportó …"). */
  protected readonly ultimoPaso = computed(() => {
    const v = this.viaje();
    const g = this.guia();
    return pasosOperador(v).find((e) => rango(v.tipo, e) === rango(v.tipo, g.estatus)) ?? null;
  });

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

  protected async pedirEstatus(estatus: EstatusViaje): Promise<void> {
    if (this.ocupado()) return;
    const saltados = this.pasos().slice(0, this.pasos().indexOf(estatus));
    const ocurrioEn = ahoraIsoUtc();
    const { permiso, explicar } = await this.permisos();
    this.abrir({ tipo: 'estatus', estatus, saltados, ocurrioEn, permiso, explicar });
  }

  protected async pedirIncidencia(): Promise<void> {
    if (this.ocupado()) return;
    const ocurrioEn = ahoraIsoUtc();
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
      await this.cola.registrar(nuevo);
      this.borrador.set(null);
      const que = b.tipo === 'estatus' ? `“${textoBoton(b.estatus)}”` : 'La incidencia';
      this.mensajes.mostrar(
        this.conexion.enLinea()
          ? `${que} guardado. Enviando a la oficina…`
          : `${que} guardado en el teléfono. Se enviará solo cuando vuelva la señal.`,
        'exito',
      );
    } catch {
      this.mensajes.mostrar('No se pudo guardar el reporte en el teléfono. Intente de nuevo.', 'error', 8000);
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
