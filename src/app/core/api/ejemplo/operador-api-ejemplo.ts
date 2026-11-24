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
 */
import { mensajeCelular, mensajePin, normalizarCelular, terminacionCelular } from '../../../shared/utils/acceso.util';
import { esHito, esPasoDelOperador, rango, textoEstatus, viajeTerminado } from '../../../shared/utils/estatus-viaje.util';
import { esTipoIncidencia } from '../../../shared/utils/incidencias.util';
import { ahoraIsoUtc, msDeIso } from '../../../shared/utils/zona-negocio.util';
import { ErrorApiOperador, OperadorApi } from '../operador-api';
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
import { CELULAR_EJEMPLO_SIN_VIAJE, salidaEjemplo } from './datos-ejemplo';

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

interface EstadoOperador {
  salida: Salida | null;
  programados: Programado[];
}

export class OperadorApiEjemplo implements OperadorApi {
  readonly esEjemplo = true;
  private readonly opciones: OpcionesEjemplo;
  private readonly recibidos = new Map<string, Recibido>();
  private readonly operadores = new Map<string, EstadoOperador>();
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
      estado = { salida: sesion.sinViaje ? null : salidaEjemplo(this.opciones.ahora()), programados: [] };
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
