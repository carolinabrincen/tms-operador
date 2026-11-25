/**
 * Implementación de EJEMPLO de OperadorApi: todo en memoria, sin red. Usa los mismos valores que el contrato M1
 * (estatus, incidencias, motivos, resultados) pero no simula HTTP, tokens ni renovación.
 *
 * Comportamiento del ejemplo:
 *  - Acceso: cualquier celular de 10 dígitos y PIN de 6 dígitos entra. El PIN no se guarda. Un celular que termine
 *    en 0000 entra sin viaje (para ver esa pantalla).
 *  - Sin conexión (navigator.onLine = false) responde como si no hubiera señal, para poder probar la cola.
 *  - Reportes IDEMPOTENTES por id (reenviar no duplica).
 *  - Estatus intermedios: se aplican al momento. Hitos (Documentado, Descargado): "por confirmar"; la oficina los
 *    confirma `confirmarHitoTrasMs` después.
 *  - Solo hacia adelante: un estatus igual o anterior al actual se recibe "sin-efecto".
 *  - La "oficina" también trabaja sola: `oficinaAvanzaTrasMs` después de "EnCarga" pone Documentado ella misma (si el
 *    operador no lo reportó), y `cierreTrasMs` después de Descargado confirmado o de la llegada en vacío cierra el viaje.
 *  - Para pruebas, la "oficina" puede además anular un hito ya confirmado (`anularHito`) y cerrar la salida
 *    (`cerrarSalida`), como en el contrato M1 (3.1 y 2).
 *  - Los mensajes van en español legible, como los del servidor (nunca el valor técnico).
 *  - M2: hoja de ruta de la salida (null sin salida) y evidencias en memoria con las reglas del contrato (solo viajes
 *    cargados, viaje cancelado, tipo y descripción, 5 MB, 30 por viaje, id idempotente con la misma foto y 409 con
 *    otra). Hay una evidencia de la oficina (PDF) en el viaje 2 que no se descarga. `anularEvidencia` (para pruebas).
 */
import { mensajeCelular, mensajePin, normalizarCelular, terminacionCelular } from '../../../shared/utils/acceso.util';
import { esHito, esPasoDelOperador, rango, textoEstatus, viajeTerminado } from '../../../shared/utils/estatus-viaje.util';
import { esTipoIncidencia } from '../../../shared/utils/incidencias.util';
import { ahoraIsoUtc, msDeIso } from '../../../shared/utils/zona-negocio.util';
import { textoEvidencia } from '../../../shared/utils/evidencias.util';
import { CODIGOS_EVIDENCIA, ErrorApiOperador, OperadorApi } from '../operador-api';
import { AcuseEvidencia, DatosEvidencia, EstadoRemotoEvidencia, EvidenciaViaje, HojaRuta, TIPOS_EVIDENCIA } from '../operador-api-m2.modelos';
import {
  AcuseReporte,
  AsignacionOperador,
  Autor,
  EstadoRemotoReporte,
  EstatusViaje,
  EventoViaje,
  ReporteEstatus,
  ReporteIncidencia,
  ReporteOperador,
  ResultadoReporte,
  Salida,
  SesionOperador,
  Viaje,
} from '../operador-api.modelos';
import { CELULAR_EJEMPLO_SIN_VIAJE, evidenciasOficinaEjemplo, hojaRutaEjemplo, salidaEjemplo } from './datos-ejemplo';

export interface OpcionesEjemplo {
  /** Operador con sesión en el teléfono (hace las veces del token). */
  operadorId: () => string | null;
  enLinea: () => boolean;
  ahora: () => Date;
  latenciaMs: number;
  /** A los cuántos ms la "oficina" confirma un hito. */
  confirmarHitoTrasMs: number;
  /** A los cuántos ms de "EnCarga" la "oficina" pone Documentado por su cuenta. */
  oficinaAvanzaTrasMs: number;
  /** A los cuántos ms la "oficina" cierra un viaje terminado por el operador. */
  cierreTrasMs: number;
}

const PREFIJO_OPERADOR = 'ej-op-';

interface Recibido {
  reporte: ReporteOperador;
  operadorId: string;
  recibidoEn: string;
  resultado: ResultadoReporte;
  mensaje: string | null;
  confirmadoEn: string | null;
}

interface Programado {
  en: number;
  secuencia: number;
  ejecutar: (en: number) => void;
}

interface EvidenciaEjemplo {
  operadorId: string;
  info: EvidenciaViaje;
  bytes: Uint8Array | null;
  recibidaEn: string;
  anulada: string | null;
}

/** Máximos del contrato M2 (2.1). */
const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024;
const MAX_EVIDENCIAS_VIAJE = 30;

interface EstadoOperador {
  salida: Salida | null;
  /** La salida que la oficina cerró: sus reportes tardíos se reciben como historial (sin efecto). */
  cerrada: Salida | null;
  programados: Programado[];
}

export class OperadorApiEjemplo implements OperadorApi {
  readonly esEjemplo = true;
  private readonly opciones: OpcionesEjemplo;
  private readonly recibidos = new Map<string, Recibido>();
  private readonly operadores = new Map<string, EstadoOperador>();
  private readonly evidencias = new Map<string, EvidenciaEjemplo>();
  private secuencia = 0;

  constructor(opciones: Partial<OpcionesEjemplo> = {}) {
    this.opciones = {
      operadorId: () => null,
      enLinea: () => globalThis.navigator?.onLine ?? true,
      ahora: () => new Date(),
      latenciaMs: 350,
      confirmarHitoTrasMs: 20_000,
      oficinaAvanzaTrasMs: 30_000,
      cierreTrasMs: 30_000,
      ...opciones,
    };
  }

  /** Cuántos reportes distintos tiene la "oficina" (para comprobar que reenviar no duplica). */
  get totalRecibidos(): number {
    return this.recibidos.size;
  }

  async iniciarSesion(celular: string, pin: string): Promise<SesionOperador> {
    await this.red();
    if (mensajeCelular(celular) || mensajePin(pin)) throw new ErrorApiOperador('sesion', 'Celular o PIN incorrectos.');
    const numero = normalizarCelular(celular);
    // El PIN se usó solo para validar; no se guarda en ningún lado.
    return { operadorId: `${PREFIJO_OPERADOR}${numero}`, nombre: 'Operador de ejemplo', celularTerminacion: terminacionCelular(numero) };
  }

  /** En el ejemplo no hay tokens: renovar funciona mientras haya operador con sesión. */
  async renovarSesion(): Promise<void> {
    await this.red();
    this.sesion();
  }

  /** En el ejemplo no hay credenciales que borrar. */
  async cerrarSesion(): Promise<void> {}

  async obtenerAsignacion(): Promise<AsignacionOperador> {
    await this.red();
    const estado = this.estadoDe(this.sesion());
    return { salida: estado.salida ? structuredClone(estado.salida) : null };
  }

  async enviarReporte(reporte: ReporteOperador): Promise<AcuseReporte> {
    await this.red();
    const sesion = this.sesion();
    const estado = this.estadoDe(sesion);
    const previo = this.recibidos.get(reporte.id);
    if (previo) {
      if (previo.operadorId !== sesion.operadorId) throw new ErrorApiOperador('rechazado', 'Ese reporte no es suyo.');
      return this.acuse(previo); // reenvío del mismo id: mismo resultado, sin duplicar
    }
    const viaje = estado.salida?.viajes.find((v) => v.id === reporte.viajeId);
    if (!viaje && estado.cerrada?.viajes.some((v) => v.id === reporte.viajeId)) {
      const tardio: Recibido = {
        reporte: structuredClone(reporte),
        operadorId: sesion.operadorId,
        recibidoEn: this.iso(),
        resultado: 'sin-efecto',
        mensaje: `La salida ${estado.cerrada.folio} ya estaba cerrada; quedó como historial.`,
        confirmadoEn: null,
      };
      this.recibidos.set(reporte.id, tardio);
      return this.acuse(tardio);
    }
    if (!viaje) throw new ErrorApiOperador('rechazado', 'Ese viaje no está asignado a usted.');
    if (msDeIso(reporte.ocurrioEn) == null) throw new ErrorApiOperador('rechazado', 'La hora del reporte no es válida.');

    const recibido =
      reporte.tipo === 'estatus' ? this.recibirEstatus(estado, viaje, reporte, sesion.operadorId) : this.recibirIncidencia(viaje, reporte, sesion.operadorId);
    this.recibidos.set(reporte.id, recibido);
    return this.acuse(recibido);
  }

  async consultarReportes(ids: string[]): Promise<EstadoRemotoReporte[]> {
    await this.red();
    const sesion = this.sesion();
    this.estadoDe(sesion); // corre lo programado
    return ids
      .map((id) => this.recibidos.get(id))
      .filter((r): r is Recibido => !!r && r.operadorId === sesion.operadorId)
      .map((r) => ({ id: r.reporte.id, resultado: r.resultado, confirmadoEn: r.confirmadoEn, mensaje: r.resultado === 'confirmado' ? null : r.mensaje }));
  }

  // ------------------------------------------------------------------ M2: hoja de ruta y evidencias

  async obtenerHojaRuta(): Promise<HojaRuta | null> {
    await this.red();
    const estado = this.estadoDe(this.sesion());
    if (!estado.salida) return null;
    const hoja = hojaRutaEjemplo(this.opciones.ahora());
    // Los viajes cancelados no aparecen (como en el servidor).
    const cancelados = new Set(estado.salida.viajes.filter((v) => v.estatus === 'Cancelado').map((v) => v.folio));
    return { ...hoja, itinerario: hoja.itinerario.filter((t) => !t.folio || !cancelados.has(t.folio)) };
  }

  async subirEvidencia(foto: Blob, datos: DatosEvidencia): Promise<AcuseEvidencia> {
    await this.red();
    const sesion = this.sesion();
    const estado = this.estadoDe(sesion);
    const bytes = new Uint8Array(await foto.arrayBuffer());
    const previa = this.evidencias.get(datos.id);
    if (previa) {
      if (previa.operadorId === sesion.operadorId && previa.bytes && mismosBytes(previa.bytes, bytes)) return this.acuseEvidencia(previa);
      throw new ErrorApiOperador('id-duplicado', 'Ese id ya se usó con otra foto.', CODIGOS_EVIDENCIA.claveDuplicada, 409);
    }
    const rechazo = (codigo: string, mensaje: string, status = 400) => new ErrorApiOperador('rechazado', mensaje, codigo, status);
    const viaje = estado.salida?.viajes.find((v) => v.id === datos.viajeId) ?? estado.cerrada?.viajes.find((v) => v.id === datos.viajeId);
    if (!viaje) throw rechazo(CODIGOS_EVIDENCIA.viajeNoEncontrado, 'El viaje no es de sus salidas.', 404);
    if (viaje.tipo !== 'cargado') throw rechazo(CODIGOS_EVIDENCIA.invalida, 'Los movimientos en vacío no reciben evidencias.');
    if (viaje.estatus === 'Cancelado') throw rechazo(CODIGOS_EVIDENCIA.estadoInvalido, 'El viaje está cancelado.', 409);
    if (!(TIPOS_EVIDENCIA as readonly string[]).includes(datos.tipo)) throw rechazo(CODIGOS_EVIDENCIA.invalida, 'Tipo de evidencia inválido.');
    if (datos.tipo === 'Otro' && !datos.descripcion?.trim()) throw rechazo(CODIGOS_EVIDENCIA.invalida, 'En “Otro” la descripción es obligatoria.');
    if ((datos.descripcion?.length ?? 0) > 150 || (datos.nota?.length ?? 0) > 500) throw rechazo(CODIGOS_EVIDENCIA.invalida, 'Descripción o nota demasiado largas.');
    if (!bytes.length || !esJpgOPng(bytes)) throw rechazo(CODIGOS_EVIDENCIA.archivoInvalido, 'El archivo no es una foto JPG o PNG.');
    if (bytes.length > MAX_BYTES_EVIDENCIA) throw rechazo(CODIGOS_EVIDENCIA.demasiadoGrande, 'La foto pesa más de 5 MB.');
    const vigentes = [...this.evidencias.values()].filter((e) => e.info.viajeId === viaje.id && !e.anulada).length;
    if (vigentes >= MAX_EVIDENCIAS_VIAJE) throw rechazo(CODIGOS_EVIDENCIA.limite, 'El viaje ya tiene 30 evidencias.');
    const nueva: EvidenciaEjemplo = {
      operadorId: sesion.operadorId,
      bytes,
      recibidaEn: this.iso(),
      anulada: null,
      info: {
        id: datos.id,
        viajeId: viaje.id,
        tipo: datos.tipo,
        descripcion: datos.descripcion,
        nota: datos.nota,
        contentType: foto.type || 'image/jpeg',
        tamanoBytes: bytes.length,
        subidaEn: this.iso(),
        tomadaEn: datos.tomadaEn,
        autor: 'operador',
      },
    };
    this.evidencias.set(datos.id, nueva);
    return this.acuseEvidencia(nueva);
  }

  async consultarEvidencias(ids: string[]): Promise<EstadoRemotoEvidencia[]> {
    await this.red();
    const sesion = this.sesion();
    return ids
      .map((id) => this.evidencias.get(id))
      .filter((e): e is EvidenciaEjemplo => !!e && e.operadorId === sesion.operadorId && e.info.autor === 'operador')
      .map((e) => ({ id: e.info.id, estado: e.anulada ? 'anulada' : 'recibida', motivo: e.anulada ? `La oficina anuló la evidencia: ${e.anulada}` : null }));
  }

  async evidenciasDeViaje(viajeId: string): Promise<EvidenciaViaje[]> {
    await this.red();
    const sesion = this.sesion();
    this.estadoDe(sesion);
    return [...this.evidencias.values()]
      .filter((e) => e.operadorId === sesion.operadorId && e.info.viajeId === viajeId && !e.anulada)
      .map((e) => structuredClone(e.info));
  }

  async archivoEvidencia(id: string): Promise<Blob | null> {
    await this.red();
    const sesion = this.sesion();
    const e = this.evidencias.get(id);
    // Como el servidor: de la oficina, anulada o ajena → 404 (sin imagen).
    if (!e || e.operadorId !== sesion.operadorId || e.info.autor !== 'operador' || e.anulada || !e.bytes) return null;
    return new Blob([e.bytes.slice()], { type: e.info.contentType ?? 'image/jpeg' });
  }

  // ------------------------------------------------------------------ acciones de la "oficina" (para pruebas)

  /** La oficina anula una evidencia: deja de estar vigente y su estado dice el motivo. */
  anularEvidencia(id: string, motivo: string): boolean {
    const e = this.evidencias.get(id);
    if (!e || e.anulada) return false;
    e.anulada = motivo;
    return true;
  }

  /**
   * La oficina anula el hito (Documentado o Descargado) que había confirmado un reporte: ese reporte pasa a
   * "sin efecto", sale del historial y el viaje vuelve al estatus anterior. Devuelve false si no hay tal hito.
   */
  anularHito(operadorId: string, viajeId: string, estatus: 'Documentado' | 'Descargado', motivo: string): boolean {
    const estado = this.operadores.get(operadorId);
    const viaje = estado?.salida?.viajes.find((v) => v.id === viajeId);
    const rec = [...this.recibidos.values()].find(
      (r) => r.operadorId === operadorId && r.resultado === 'confirmado' && r.reporte.viajeId === viajeId && r.reporte.tipo === 'estatus' && r.reporte.estatus === estatus,
    );
    if (!viaje || !rec) return false;
    rec.resultado = 'sin-efecto';
    rec.confirmadoEn = null;
    rec.mensaje = `La oficina anuló el estatus ${textoEstatus(estatus)}: ${motivo}. Puedes volver a reportarlo.`;
    viaje.historial = viaje.historial.filter((e) => e.reporteId !== rec.reporte.id);
    const anterior = viaje.historial
      .filter((e): e is EventoViaje & { tipo: 'estatus' } => e.tipo === 'estatus')
      .reduce<EstatusViaje>((mejor, e) => (rango(viaje.tipo, e.estatus) > rango(viaje.tipo, mejor) ? e.estatus : mejor), 'Asignado');
    (viaje as { estatus: EstatusViaje }).estatus = anterior;
    return true;
  }

  /** La oficina cierra la salida del operador: la asignación llega sin salida. */
  cerrarSalida(operadorId: string): void {
    const estado = this.operadores.get(operadorId);
    if (!estado?.salida) return;
    estado.cerrada = estado.salida;
    estado.salida = null;
    estado.programados = [];
  }

  // ------------------------------------------------------------------ reglas del ejemplo

  private recibirEstatus(estado: EstadoOperador, viaje: Viaje, r: ReporteEstatus, operadorId: string): Recibido {
    if (!esPasoDelOperador(viaje, r.estatus)) {
      throw new ErrorApiOperador('rechazado', 'Ese estatus no lo puede poner el operador en este viaje.');
    }
    const base = { reporte: structuredClone(r), operadorId, recibidoEn: this.iso(), confirmadoEn: null };
    if (rango(viaje.tipo, r.estatus) <= rango(viaje.tipo, viaje.estatus)) {
      return {
        ...base,
        resultado: 'sin-efecto',
        mensaje: `La oficina ya registró ${textoEstatus(viaje.estatus)}; el estatus no cambió.`,
      };
    }
    if (esHito(r.estatus)) {
      this.programar(estado, this.opciones.confirmarHitoTrasMs, (en) => {
        const rec = this.recibidos.get(r.id);
        if (!rec) return;
        rec.resultado = 'confirmado';
        rec.confirmadoEn = ahoraIsoUtc(new Date(en));
        // Lo ocurrido queda en el historial aunque el viaje ya vaya más adelante.
        this.poner(viaje, r.estatus, r.ocurrioEn, 'operador', r.id, true);
        if (r.estatus === 'Descargado') this.programarCierre(estado, viaje, en);
      });
      return { ...base, resultado: 'por-confirmar', mensaje: 'Recibido; la oficina lo confirma.' };
    }
    this.poner(viaje, r.estatus, r.ocurrioEn, 'operador', r.id, false);
    if (r.estatus === 'EnCarga') {
      // La oficina captura toneladas y pone Documentado por su cuenta, salvo que el operador ya lo haya reportado.
      this.programar(estado, this.opciones.oficinaAvanzaTrasMs, (en) => {
        const hitoDelOperador = [...this.recibidos.values()].some(
          (x) => x.reporte.viajeId === viaje.id && x.reporte.tipo === 'estatus' && x.reporte.estatus === 'Documentado',
        );
        if (!hitoDelOperador) this.poner(viaje, 'Documentado', ahoraIsoUtc(new Date(en)), 'oficina', null, false);
      });
    }
    if (viaje.tipo === 'vacio' && (r.estatus === 'EnPatio' || r.estatus === 'EnTaller')) this.programarCierre(estado, viaje);
    return { ...base, resultado: 'aplicado', mensaje: null };
  }

  private recibirIncidencia(viaje: Viaje, r: ReporteIncidencia, operadorId: string): Recibido {
    if (!esTipoIncidencia(r.incidencia)) throw new ErrorApiOperador('rechazado', 'Tipo de incidencia desconocido.');
    if (r.incidencia === 'Otro' && !r.nota?.trim()) throw new ErrorApiOperador('rechazado', 'En “Otro” la nota es obligatoria.');
    if (viajeTerminado(viaje)) throw new ErrorApiOperador('rechazado', 'El viaje ya está cerrado.');
    this.insertar(viaje, { tipo: 'incidencia', incidencia: r.incidencia, nota: r.nota, ocurrioEn: r.ocurrioEn, autor: 'operador', reporteId: r.id });
    return { reporte: structuredClone(r), operadorId, recibidoEn: this.iso(), resultado: 'registrado', mensaje: null, confirmadoEn: null };
  }

  private programarCierre(estado: EstadoOperador, viaje: Viaje, desde?: number): void {
    this.programar(estado, this.opciones.cierreTrasMs, (en) => this.poner(viaje, 'Cerrado', ahoraIsoUtc(new Date(en)), 'oficina', null, false), desde);
  }

  /** Pone un estatus si avanza; con `aunqueNoAvance` lo deja en el historial aunque el viaje ya vaya adelante. */
  private poner(viaje: Viaje, e: EstatusViaje, ocurrioEn: string, autor: Autor, reporteId: string | null, aunqueNoAvance: boolean): void {
    const avanza = rango(viaje.tipo, e) > rango(viaje.tipo, viaje.estatus);
    if (avanza) (viaje as { estatus: EstatusViaje }).estatus = e;
    if (avanza || aunqueNoAvance) this.insertar(viaje, { tipo: 'estatus', estatus: e, nota: null, ocurrioEn, autor, reporteId });
  }

  private insertar(viaje: Viaje, evento: EventoViaje): void {
    viaje.historial.push(evento);
    viaje.historial.sort((a, b) => a.ocurrioEn.localeCompare(b.ocurrioEn));
  }

  // ------------------------------------------------------------------ internos

  /** Agenda una acción de la "oficina" trasMs después de `desde` (por omisión, ahora). */
  private programar(estado: EstadoOperador, trasMs: number, ejecutar: (en: number) => void, desde = this.opciones.ahora().getTime()): void {
    estado.programados.push({ en: desde + trasMs, secuencia: this.secuencia++, ejecutar });
  }

  /** Estado del operador, con lo programado que ya debió ocurrir aplicado. */
  private estadoDe(sesion: { operadorId: string; sinViaje: boolean }): EstadoOperador {
    let estado = this.operadores.get(sesion.operadorId);
    if (!estado) {
      estado = { salida: sesion.sinViaje ? null : salidaEjemplo(this.opciones.ahora()), cerrada: null, programados: [] };
      if (estado.salida) {
        for (const info of evidenciasOficinaEjemplo(this.opciones.ahora())) {
          this.evidencias.set(`${sesion.operadorId}:${info.id}`, { operadorId: sesion.operadorId, info, bytes: null, recibidaEn: info.subidaEn, anulada: null });
        }
      }
      this.operadores.set(sesion.operadorId, estado);
    }
    const ahora = this.opciones.ahora().getTime();
    // Lo que se programa al ejecutar (p. ej. un cierre) se revisa en la misma vuelta si ya le tocaba.
    for (;;) {
      const listos = estado.programados.filter((p) => p.en <= ahora).sort((a, b) => a.en - b.en || a.secuencia - b.secuencia);
      if (!listos.length) break;
      const p = listos[0];
      estado.programados.splice(estado.programados.indexOf(p), 1);
      p.ejecutar(p.en);
    }
    return estado;
  }

  private acuse(r: Recibido): AcuseReporte {
    return { id: r.reporte.id, recibidoEn: r.recibidoEn, resultado: r.resultado, mensaje: r.mensaje };
  }

  private iso(): string {
    return ahoraIsoUtc(this.opciones.ahora());
  }

  private acuseEvidencia(e: EvidenciaEjemplo): AcuseEvidencia {
    return { id: e.info.id, recibidaEn: e.recibidaEn, mensaje: `Recibida: ${textoEvidencia(e.info.tipo)}.` };
  }

  private async red(): Promise<void> {
    if (this.opciones.latenciaMs > 0) await new Promise((r) => setTimeout(r, this.opciones.latenciaMs));
    if (!this.opciones.enLinea()) throw new ErrorApiOperador('sin-conexion', 'Sin conexión.');
  }

  private sesion(): { operadorId: string; sinViaje: boolean } {
    const operadorId = this.opciones.operadorId();
    if (!operadorId?.startsWith(PREFIJO_OPERADOR)) throw new ErrorApiOperador('sesion', 'Su sesión terminó. Entre de nuevo.');
    return { operadorId, sinViaje: CELULAR_EJEMPLO_SIN_VIAJE.test(operadorId) };
  }
}

function mismosBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Como el servidor: se revisa el CONTENIDO (firma JPEG FF D8 FF o PNG 89 50 4E 47), no la extensión. */
function esJpgOPng(b: Uint8Array): boolean {
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  return jpg || png;
}
