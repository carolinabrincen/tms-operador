import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  conEnvioExitoso,
  conEstadoRemoto,
  conFallaEnvio,
  crearReporteLocal,
  ordenarRecientes,
  porConfirmar,
  porEnviar,
  retrasoReintentoMs,
} from '../../shared/utils/cola-reportes.util';
import { generarIdReporte } from '../../shared/utils/id-reporte.util';
import { ahoraIsoUtc } from '../../shared/utils/zona-negocio.util';
import { OPERADOR_API, comoErrorApi } from '../api/operador-api';
import { ReporteEstatus, ReporteIncidencia } from '../api/operador-api.modelos';
import { ConexionService } from '../conexion/conexion.service';
import { NAVEGADOR, RELOJ } from '../plataforma';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';
import { ALMACEN_REPORTES } from './almacen-reportes';
import { ReporteLocal } from './reporte-local';

/** Un reporte por registrar: todo menos el id (lo pone la cola) y el texto para mostrarlo en la lista. */
export type NuevoReporte = (Omit<ReporteEstatus, 'id'> | Omit<ReporteIncidencia, 'id'>) & { resumen: string };

/**
 * Cola de reportes del teléfono. Cada reporte:
 *  1. nace con un id único generado aquí,
 *  2. se GUARDA en IndexedDB,
 *  3. y después se intenta enviar. Si no hay señal se queda pendiente y se reintenta solo: al recuperar la conexión,
 *     al volver a la app y con espera creciente si el servidor falla.
 * Reenviar el mismo id no duplica (la API es idempotente por id).
 */
@Injectable({ providedIn: 'root' })
export class ColaReportesService {
  private readonly api = inject(OPERADOR_API);
  private readonly almacen = inject(ALMACEN_REPORTES);
  private readonly sesion = inject(AlmacenSesion);
  private readonly conexion = inject(ConexionService);
  private readonly navegador = inject(NAVEGADOR);
  private readonly reloj = inject(RELOJ);

  private readonly todosSig = signal<ReporteLocal[]>([]);
  private readonly enviandoSig = signal(false);
  private readonly reintentoSig = signal<string | null>(null);
  private readonly enviadosSig = signal(0);
  private readonly cargaInicial: Promise<void>;
  private corriendo: Promise<void> | null = null;
  private repetir = false;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private pidioPersistencia = false;

  /** Reportes del operador con sesión, lo más reciente primero. */
  readonly reportes = computed(() => {
    const id = this.sesion.operadorId();
    return id ? ordenarRecientes(this.todosSig().filter((r) => r.operadorId === id)) : [];
  });
  readonly pendientes = computed(() => this.reportes().filter((r) => r.estado === 'pendiente').length);
  readonly enviando = this.enviandoSig.asReadonly();
  /** Cuándo será el próximo reintento automático (ISO), o null. */
  readonly proximoReintento = this.reintentoSig.asReadonly();
  readonly persistente = () => this.almacen.persistente;
  /** Sube cada vez que el servidor recibe un reporte o confirma un hito: las pantallas lo usan para releer el viaje. */
  readonly enviados = this.enviadosSig.asReadonly();

  constructor() {
    this.cargaInicial = this.recargar();
    // Lo que quedó pendiente de una sesión anterior de la app se intenta enviar al arrancar.
    void this.cargaInicial.then(() => this.procesar());
    const baja = this.conexion.alRecuperar(() => void this.procesar());
    inject(DestroyRef).onDestroy(() => {
      baja();
      this.cancelarReintento();
    });
  }

  /** Espera a que se haya leído la cola guardada (útil en pruebas y al arrancar). */
  listo(): Promise<void> {
    return this.cargaInicial;
  }

  /** Espera a que termine el envío en curso, si lo hay, sin pedir otro. */
  async inactivo(): Promise<void> {
    await this.cargaInicial;
    while (this.corriendo) await this.corriendo;
  }

  /** Guarda el reporte en el teléfono y luego intenta enviarlo (sin esperar el envío). */
  async registrar(nuevo: NuevoReporte): Promise<ReporteLocal> {
    const operadorId = this.sesion.operadorId();
    if (!operadorId) throw new Error('No hay sesión: no se puede registrar el reporte.');
    await this.cargaInicial;
    const { resumen, ...datos } = nuevo;
    const reporte = { ...datos, id: generarIdReporte(), nota: datos.nota?.trim() ? datos.nota.trim() : null } as ReporteEstatus | ReporteIncidencia;
    const local = crearReporteLocal(reporte, operadorId, resumen, ahoraIsoUtc(this.reloj()));
    await this.almacen.guardar(local); // PRIMERO se guarda…
    this.poner(local);
    void this.pedirPersistencia();
    void this.procesar(); // …después se envía.
    return local;
  }

  /**
   * Envía los pendientes del operador, en orden. Una sola corrida a la vez; si se pide otra mientras corre, se repite
   * al terminar. Se detiene al primer error de conexión/servidor (los siguientes fallarían igual) y agenda reintento.
   */
  procesar(): Promise<void> {
    if (this.corriendo) {
      this.repetir = true;
      return this.corriendo;
    }
    this.corriendo = (async () => {
      try {
        do {
          this.repetir = false;
          await this.unaCorrida();
        } while (this.repetir);
      } finally {
        this.corriendo = null;
        this.enviandoSig.set(false);
      }
    })();
    return this.corriendo;
  }

  /** Pregunta al servidor si la oficina ya confirmó los hitos enviados. Sin conexión no hace nada. */
  async actualizarEstados(): Promise<void> {
    await this.cargaInicial;
    const operadorId = this.sesion.operadorId();
    if (!operadorId || !this.conexion.enLinea()) return;
    const esperando = porConfirmar(this.todosSig(), operadorId);
    if (!esperando.length) return;
    try {
      const remotos = await this.api.consultarReportes(esperando.map((r) => r.id));
      const ahora = ahoraIsoUtc(this.reloj());
      for (const remoto of remotos) {
        const actual = this.todosSig().find((r) => r.id === remoto.id);
        if (!actual) continue;
        const nuevo = conEstadoRemoto(actual, remoto, ahora);
        if (nuevo !== actual) {
          await this.guardarYPoner(nuevo);
          this.enviadosSig.update((n) => n + 1);
        }
      }
    } catch (e) {
      if (comoErrorApi(e).tipo === 'sesion') this.sesion.vencer(MENSAJE_SESION_VENCIDA);
      // Cualquier otro error: se intentará la próxima vez.
    }
  }

  // ------------------------------------------------------------------ internos

  private async unaCorrida(): Promise<void> {
    await this.cargaInicial;
    const operadorId = this.sesion.operadorId();
    if (!operadorId) return;
    // Se relee del almacén: otra pestaña pudo haber agregado o enviado reportes.
    await this.recargar();
    const cola = porEnviar(this.todosSig(), operadorId);
    if (!cola.length) {
      this.cancelarReintento();
      return;
    }
    if (!this.conexion.enLinea()) return; // se reintenta solo al recuperar la conexión
    this.cancelarReintento();
    this.enviandoSig.set(true);
    for (const r of cola) {
      if (this.sesion.operadorId() !== operadorId) return; // cambió la sesión a medio camino
      try {
        const acuse = await this.api.enviarReporte(r.reporte);
        await this.guardarYPoner(conEnvioExitoso(r, acuse, ahoraIsoUtc(this.reloj())));
        this.enviadosSig.update((n) => n + 1);
      } catch (e) {
        const error = comoErrorApi(e);
        const actualizado = conFallaEnvio(r, error.tipo, error.message, ahoraIsoUtc(this.reloj()));
        await this.guardarYPoner(actualizado);
        if (error.tipo === 'rechazado') continue; // no detiene a los demás
        if (error.tipo === 'sesion') {
          this.sesion.vencer(MENSAJE_SESION_VENCIDA);
          return;
        }
        this.agendarReintento(actualizado.intentos);
        return;
      }
    }
  }

  private agendarReintento(intentos: number): void {
    this.cancelarReintento();
    const espera = retrasoReintentoMs(intentos);
    this.reintentoSig.set(ahoraIsoUtc(new Date(this.reloj().getTime() + espera)));
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.reintentoSig.set(null);
      void this.procesar();
    }, espera);
  }

  private cancelarReintento(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.reintentoSig.set(null);
  }

  private async recargar(): Promise<void> {
    try {
      const guardados = await this.almacen.todos();
      const ids = new Set(guardados.map((r) => r.id));
      // El almacén manda; lo que esté en memoria y aún no se vea en él (recién creado) se conserva.
      this.todosSig.update((enMemoria) => [...guardados, ...enMemoria.filter((r) => !ids.has(r.id))]);
    } catch {
      // Si no se puede leer, se conserva lo que hay en memoria.
    }
  }

  private async guardarYPoner(r: ReporteLocal): Promise<void> {
    await this.almacen.guardar(r);
    this.poner(r);
  }

  private poner(r: ReporteLocal): void {
    this.todosSig.update((lista) => [...lista.filter((x) => x.id !== r.id), r]);
  }

  /** Pide al navegador no borrar la cola si se llena el almacenamiento (mejor esfuerzo, una vez). */
  private async pedirPersistencia(): Promise<void> {
    if (this.pidioPersistencia) return;
    this.pidioPersistencia = true;
    try {
      if (this.navegador.storage?.persisted && (await this.navegador.storage.persisted())) return;
      await this.navegador.storage?.persist?.();
    } catch {
      // Sin efecto: la cola funciona igual.
    }
  }
}
