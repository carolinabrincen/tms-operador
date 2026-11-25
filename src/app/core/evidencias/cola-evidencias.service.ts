import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  avisoFotosAcumuladas,
  conAcuseFoto,
  conLigaNueva,
  conEstadoRemotoFoto,
  conFallaFoto,
  conNuevoIdFoto,
  conReenvioFoto,
  crearEvidenciaLocal,
  fotosPorConsultar,
  fotosPorEnviar,
  fotosRecientes,
  mensajeErrorFoto,
  retrasoReintentoFotoMs,
  sinLiga,
  sinLigaPerdida,
} from '../../shared/utils/evidencias.util';
import { bytesDeBlob } from '../../shared/utils/foto.util';
import { generarIdReporte } from '../../shared/utils/id-reporte.util';
import { ahoraIsoUtc } from '../../shared/utils/zona-negocio.util';
import { AcuseEvidencia, DatosEvidencia } from '../api/operador-api-m2.modelos';
import { CODIGOS_EVIDENCIA, OPERADOR_API, comoErrorApi } from '../api/operador-api';
import { ConexionService } from '../conexion/conexion.service';
import { NAVEGADOR, RELOJ } from '../plataforma';
import { ColaReportesService } from '../reportes/cola-reportes.service';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';
import { AsignacionService } from '../viaje/asignacion.service';
import { ALMACEN_EVIDENCIAS } from './almacen-evidencias';
import { EvidenciaLocal } from './evidencia-local';

/** Cuántas veces se cambia el id de una foto por 409 de id duplicado antes de darla por no aceptada. */
const MAX_CAMBIOS_DE_ID = 3;

/** Una foto por registrar: todo menos el id (lo pone la cola), con la foto ya reducida. */
export interface NuevaEvidencia {
  datos: Omit<DatosEvidencia, 'id'>;
  foto: Blob;
  /** Texto para la lista ("Viaje 2 · Cargado · …"). */
  resumen: string;
}

/**
 * Cola de fotos del teléfono (contrato M2, 2.1 y 2.2). Igual que la de reportes:
 *  1. cada foto nace con su id (generado aquí),
 *  2. se GUARDA en IndexedDB con la foto ya reducida,
 *  3. y después se sube. Sin señal se queda pendiente y se reintenta sola: al volver la señal, al volver a la app y
 *     con espera creciente si el servidor falla. Reenviar el mismo id con la misma foto no duplica (200).
 *
 * Una foto ligada a un reporte (p. ej. el acuse del Descargado) espera a que ese reporte llegue al servidor; si el
 * reporte cambia de id (409), la foto sigue al id nuevo; si el reporte ya no existe, no fue aceptado o el servidor
 * rechaza la liga, la foto se envía sin liga (importa más que llegue).
 * 409 de id duplicado (ese id con otra foto) → otro id y se reenvía. 400/404/409 → "No aceptada" con un texto de usted.
 */
@Injectable({ providedIn: 'root' })
export class ColaEvidenciasService {
  private readonly api = inject(OPERADOR_API);
  private readonly almacen = inject(ALMACEN_EVIDENCIAS);
  private readonly sesion = inject(AlmacenSesion);
  private readonly conexion = inject(ConexionService);
  private readonly navegador = inject(NAVEGADOR);
  private readonly reloj = inject(RELOJ);
  private readonly reportes = inject(ColaReportesService);
  private readonly asignacion = inject(AsignacionService);

  private readonly todasSig = signal<EvidenciaLocal[]>([]);
  private readonly enviandoSig = signal(false);
  private readonly reintentoSig = signal<string | null>(null);
  private readonly cargaInicial: Promise<void>;
  private corriendo: Promise<void> | null = null;
  private repetir = false;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private pidioPersistencia = false;

  /** Fotos del operador con sesión, lo más reciente primero. */
  readonly fotos = computed(() => {
    const id = this.sesion.operadorId();
    return id ? fotosRecientes(this.todasSig().filter((f) => f.operadorId === id)) : [];
  });
  readonly pendientes = computed(() => this.fotos().filter((f) => f.estado === 'pendiente').length);
  /** Aviso si se acumulan muchas fotos sin enviar. */
  readonly avisoAcumuladas = computed(() => avisoFotosAcumuladas(this.pendientes()));
  readonly enviando = this.enviandoSig.asReadonly();
  readonly proximoReintento = this.reintentoSig.asReadonly();
  readonly persistente = () => this.almacen.persistente;
  /** Sugerencias de foto del acuse a las que el operador dijo "Ahora no" (por id del Descargado; solo en memoria). */
  private readonly omitidasSig = signal<ReadonlySet<string>>(new Set());
  readonly sugerenciasOmitidas = this.omitidasSig.asReadonly();

  constructor() {
    this.cargaInicial = this.recargar();
    void this.cargaInicial.then(() => this.procesar());
    const baja = this.conexion.alRecuperar(() => void this.procesar());
    const bajaCambioId = this.reportes.alCambiarId((viejo, nuevo) => this.religar(viejo, nuevo));
    // Cuando un reporte llega al servidor, la foto ligada a él (p. ej. el acuse) ya puede subirse.
    let visto = this.reportes.enviados();
    effect(() => {
      const n = this.reportes.enviados();
      if (n === visto) return;
      visto = n;
      untracked(() => void this.procesar());
    });
    inject(DestroyRef).onDestroy(() => {
      baja();
      bajaCambioId();
      this.cancelarReintento();
    });
  }

  listo(): Promise<void> {
    return this.cargaInicial;
  }

  /** Espera a que termine la subida en curso, si la hay. */
  async inactivo(): Promise<void> {
    await this.cargaInicial;
    while (this.corriendo) await this.corriendo;
  }

  omitirSugerencia(reporteId: string): void {
    this.omitidasSig.update((s) => new Set([...s, reporteId]));
  }

  /** Fotos de un viaje, lo más reciente primero. */
  deViaje(viajeId: string): EvidenciaLocal[] {
    return this.fotos().filter((f) => f.datos.viajeId === viajeId);
  }

  /** Guarda la foto en el teléfono y luego intenta subirla (sin esperar la subida). */
  async registrar(nueva: NuevaEvidencia): Promise<EvidenciaLocal> {
    const operadorId = this.sesion.operadorId();
    if (!operadorId) throw new Error('No hay sesión: no se puede guardar la foto.');
    await this.cargaInicial;
    const limpio = (t: string | null) => (t?.trim() ? t.trim() : null);
    const datos: DatosEvidencia = {
      ...nueva.datos,
      id: generarIdReporte(),
      descripcion: limpio(nueva.datos.descripcion),
      nota: limpio(nueva.datos.nota),
    };
    const bytes = await bytesDeBlob(nueva.foto);
    const local = crearEvidenciaLocal(datos, operadorId, nueva.resumen, bytes, nueva.foto.type || 'image/jpeg', ahoraIsoUtc(this.reloj()));
    await this.almacen.guardar(local); // PRIMERO se guarda…
    this.poner(local);
    void this.pedirPersistencia();
    void this.procesar(); // …después se sube.
    return local;
  }

  /** Sube las pendientes del operador, en orden. Una sola corrida a la vez (si piden otra, se repite al terminar). */
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

  /**
   * Pregunta al servidor por las enviadas (¿llegaron?) y las recibidas de la salida activa (la oficina puede
   * anularlas). Una enviada que el servidor no conoce se vuelve a subir con el mismo id. Sin conexión no hace nada.
   */
  async actualizarEstados(): Promise<void> {
    await this.cargaInicial;
    const operadorId = this.sesion.operadorId();
    if (!operadorId || !this.conexion.enLinea()) return;
    const activos = new Set((this.asignacion.asignacion()?.salida?.viajes ?? []).map((v) => v.id));
    const consultar = fotosPorConsultar(this.todasSig(), operadorId, activos);
    if (!consultar.length) return;
    try {
      const remotos = new Map((await this.api.consultarEvidencias(consultar.map((f) => f.id))).map((r) => [r.id, r]));
      let reenviar = false;
      for (const f of consultar) {
        const actual = this.todasSig().find((x) => x.id === f.id);
        if (!actual) continue;
        const remoto = remotos.get(f.id);
        const nuevo = remoto ? conEstadoRemotoFoto(actual, remoto) : conReenvioFoto(actual);
        if (nuevo === actual) continue;
        if (nuevo.estado === 'pendiente') reenviar = true;
        await this.guardarYPoner(nuevo);
      }
      if (reenviar) void this.procesar();
    } catch (e) {
      if (comoErrorApi(e).tipo === 'sesion') this.sesion.vencer(MENSAJE_SESION_VENCIDA);
    }
  }

  // ------------------------------------------------------------------ internos

  /** El reporte ligado cambió de id: las fotos ligadas al viejo pasan al nuevo (en memoria y en el teléfono). */
  private async religar(viejo: string, nuevo: string): Promise<void> {
    await this.cargaInicial;
    for (const f of this.todasSig()) {
      const religada = conLigaNueva(f, viejo, nuevo);
      if (religada !== f) await this.guardarYPoner(religada);
    }
  }

  /** Sube una foto; si el servidor rechaza la liga al reporte (VIAJE_EVIDENCIA_INVALIDA), la reintenta sin liga. */
  private async subir(f: EvidenciaLocal): Promise<{ acuse: AcuseEvidencia; foto: EvidenciaLocal }> {
    const blob = () => new Blob([f.foto!], { type: f.tipoContenido });
    try {
      return { acuse: await this.api.subirEvidencia(blob(), f.datos), foto: f };
    } catch (e) {
      const error = comoErrorApi(e);
      if (!f.datos.reporteId || error.tipo !== 'rechazado' || error.codigo !== CODIGOS_EVIDENCIA.invalida) throw e;
      const suelta = sinLiga(f);
      return { acuse: await this.api.subirEvidencia(blob(), suelta.datos), foto: suelta };
    }
  }

  private async unaCorrida(): Promise<void> {
    await this.cargaInicial;
    const operadorId = this.sesion.operadorId();
    if (!operadorId) return;
    await this.recargar(); // otra pestaña pudo agregar o subir fotos
    await this.reportes.listo(); // para saber si el reporte ligado existe, la cola de reportes debe estar leída
    const cola = fotosPorEnviar(this.todasSig(), operadorId, this.reportes.reportes());
    if (!cola.length) {
      this.cancelarReintento();
      return;
    }
    if (!this.conexion.enLinea()) return; // se reintenta sola al volver la señal
    this.cancelarReintento();
    this.enviandoSig.set(true);
    for (const original of cola) {
      if (this.sesion.operadorId() !== operadorId) return;
      let f = sinLigaPerdida(original, this.reportes.reportes());
      if (f !== original) await this.guardarYPoner(f); // el reporte ligado ya no existe o no fue aceptado
      try {
        const subida = await this.subir(f);
        f = subida.foto;
        await this.guardarYPoner(conAcuseFoto(f, subida.acuse, ahoraIsoUtc(this.reloj())));
      } catch (e) {
        const error = comoErrorApi(e);
        if (error.tipo === 'id-duplicado' && f.intentos < MAX_CAMBIOS_DE_ID) {
          await this.cambiarId(f);
          this.repetir = true;
          return;
        }
        const tipo = error.tipo === 'id-duplicado' ? 'rechazado' : error.tipo;
        const mensaje = tipo === 'rechazado' ? mensajeErrorFoto(error.codigo, error.message) : error.message;
        const actualizado = conFallaFoto(f, tipo, mensaje, ahoraIsoUtc(this.reloj()));
        await this.guardarYPoner(actualizado);
        if (tipo === 'rechazado') continue; // no detiene a las demás
        if (error.tipo === 'sesion') {
          this.sesion.vencer(MENSAJE_SESION_VENCIDA);
          return;
        }
        this.agendarReintento(actualizado.intentos);
        return;
      }
    }
  }

  private async cambiarId(f: EvidenciaLocal): Promise<void> {
    const nuevo = { ...conNuevoIdFoto(f, generarIdReporte()), intentos: f.intentos + 1 };
    await this.almacen.guardar(nuevo); // primero la nueva, para no quedarse sin ninguna
    await this.almacen.eliminar(f.id);
    this.todasSig.update((lista) => [...lista.filter((x) => x.id !== f.id), nuevo]);
  }

  private agendarReintento(intentos: number): void {
    this.cancelarReintento();
    const espera = retrasoReintentoFotoMs(intentos);
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
      const guardadas = await this.almacen.todas();
      const ids = new Set(guardadas.map((f) => f.id));
      this.todasSig.update((enMemoria) => [...guardadas, ...enMemoria.filter((f) => !ids.has(f.id))]);
    } catch {
      // Si no se puede leer, se conserva lo que hay en memoria.
    }
  }

  private async guardarYPoner(f: EvidenciaLocal): Promise<void> {
    await this.almacen.guardar(f);
    this.poner(f);
  }

  private poner(f: EvidenciaLocal): void {
    this.todasSig.update((lista) => [...lista.filter((x) => x.id !== f.id), f]);
  }

  /** Pide al navegador no borrar las fotos guardadas si se llena el almacenamiento (mejor esfuerzo, una vez). */
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
