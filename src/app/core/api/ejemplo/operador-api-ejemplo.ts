/**
 * Implementación de EJEMPLO de OperadorApi: todo en memoria, sin red. NO describe la API real (que aún no existe).
 *
 * Comportamiento del ejemplo:
 *  - Acceso: cualquier celular de 10 dígitos y PIN numérico válido entra. El PIN no se guarda. Un celular que termine
 *    en 0000 entra sin despacho activo (para ver esa pantalla).
 *  - Sin conexión (navigator.onLine = false, p. ej. modo avión o "Offline" en DevTools) responde como si no hubiera
 *    señal, para poder probar la cola.
 *  - Reportes: IDEMPOTENTE por id (reenviar no duplica). La "oficina" confirma cada reporte unos segundos después de
 *    recibirlo (confirmarTrasMs).
 *  - Solo acepta reportes de tramos o movimientos que sí tiene asignados ese operador.
 */
import { mensajeCelular, mensajePin, normalizarCelular, terminacionCelular } from '../../../shared/utils/acceso.util';
import { AVANCES_VACIO, AVANCES_VIAJE } from '../../../shared/utils/avances.util';
import { ahoraIsoUtc, msDeIso } from '../../../shared/utils/zona-negocio.util';
import { ErrorApiOperador, OperadorApi } from '../operador-api';
import { AcuseReporte, AsignacionOperador, EstadoRemotoReporte, ReporteAvance, SesionOperador } from '../operador-api.modelos';
import { CELULAR_EJEMPLO_SIN_DESPACHO, asignacionEjemplo } from './datos-ejemplo';

export interface OpcionesEjemplo {
  /** Token de la sesión actual (como lo mandaría un interceptor HTTP). */
  token: () => string | null;
  enLinea: () => boolean;
  ahora: () => Date;
  latenciaMs: number;
  /** A los cuántos ms de recibido la "oficina" confirma un reporte. */
  confirmarTrasMs: number;
}

const PREFIJO_TOKEN = 'ejemplo';

interface Recibido {
  reporte: ReporteAvance;
  operadorId: string;
  acuse: AcuseReporte;
}

export class OperadorApiEjemplo implements OperadorApi {
  readonly esEjemplo = true;
  private readonly opciones: OpcionesEjemplo;
  private readonly recibidos = new Map<string, Recibido>();

  constructor(opciones: Partial<OpcionesEjemplo> = {}) {
    this.opciones = {
      token: () => null,
      enLinea: () => globalThis.navigator?.onLine ?? true,
      ahora: () => new Date(),
      latenciaMs: 350,
      confirmarTrasMs: 20_000,
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
    const operadorId = `ej-op-${numero}`;
    const sinDespacho = CELULAR_EJEMPLO_SIN_DESPACHO.test(numero) ? '1' : '0';
    // El PIN se usó solo para validar; no se guarda en ningún lado.
    return {
      operadorId,
      nombre: 'Operador de ejemplo',
      celularTerminacion: terminacionCelular(numero),
      token: `${PREFIJO_TOKEN}.${operadorId}.${sinDespacho}`,
    };
  }

  async obtenerAsignacion(): Promise<AsignacionOperador> {
    await this.red();
    const { sinDespacho } = this.sesion();
    return asignacionEjemplo(this.opciones.ahora(), sinDespacho);
  }

  async enviarReporte(reporte: ReporteAvance): Promise<AcuseReporte> {
    await this.red();
    const { operadorId, sinDespacho } = this.sesion();
    const previo = this.recibidos.get(reporte.id);
    if (previo) {
      if (previo.operadorId !== operadorId) throw new ErrorApiOperador('rechazado', 'Ese reporte no es suyo.');
      // Reenvío del mismo id: mismo acuse, sin duplicar.
      return this.acuseActual(previo);
    }
    this.validar(reporte, asignacionEjemplo(this.opciones.ahora(), sinDespacho));
    const acuse: AcuseReporte = { id: reporte.id, recibidoEn: ahoraIsoUtc(this.opciones.ahora()), confirmado: false };
    this.recibidos.set(reporte.id, { reporte: structuredClone(reporte), operadorId, acuse });
    return { ...acuse };
  }

  async consultarReportes(ids: string[]): Promise<EstadoRemotoReporte[]> {
    await this.red();
    const { operadorId } = this.sesion();
    const estados: EstadoRemotoReporte[] = [];
    for (const id of ids) {
      const r = this.recibidos.get(id);
      if (!r || r.operadorId !== operadorId) continue;
      const acuse = this.acuseActual(r);
      estados.push({ id, confirmado: acuse.confirmado, confirmadoEn: acuse.confirmado ? this.confirmadoEn(r) : null });
    }
    return estados;
  }

  // ------------------------------------------------------------------ internos

  private async red(): Promise<void> {
    if (this.opciones.latenciaMs > 0) await new Promise((r) => setTimeout(r, this.opciones.latenciaMs));
    if (!this.opciones.enLinea()) throw new ErrorApiOperador('sin-conexion', 'Sin conexión.');
  }

  private sesion(): { operadorId: string; sinDespacho: boolean } {
    const partes = (this.opciones.token() ?? '').split('.');
    if (partes.length !== 3 || partes[0] !== PREFIJO_TOKEN || !partes[1]) {
      throw new ErrorApiOperador('sesion', 'Su sesión terminó. Entre de nuevo.');
    }
    return { operadorId: partes[1], sinDespacho: partes[2] === '1' };
  }

  private validar(reporte: ReporteAvance, asignacion: AsignacionOperador): void {
    if (!reporte.id) throw new ErrorApiOperador('rechazado', 'El reporte no trae id.');
    if (msDeIso(reporte.ocurrioEn) == null) throw new ErrorApiOperador('rechazado', 'La hora del reporte no es válida.');
    const o = reporte.objetivo;
    if (o.tipo === 'tramo') {
      const d = asignacion.despacho;
      const tramo = d && d.id === o.despachoId ? d.tramos.find((t) => t.id === o.tramoId) : undefined;
      if (!tramo) throw new ErrorApiOperador('rechazado', 'Ese tramo no está en su despacho.');
      const validos = tramo.tipo === 'cargado' ? AVANCES_VIAJE : AVANCES_VACIO;
      if (!validos.includes(reporte.avance)) throw new ErrorApiOperador('rechazado', 'Ese avance no aplica a este tramo.');
    } else {
      if (!asignacion.movimientosVacio.some((m) => m.id === o.movimientoId)) {
        throw new ErrorApiOperador('rechazado', 'Ese movimiento no está asignado a usted.');
      }
      if (!AVANCES_VACIO.includes(reporte.avance)) throw new ErrorApiOperador('rechazado', 'Ese avance no aplica a un movimiento en vacío.');
    }
  }

  private acuseActual(r: Recibido): AcuseReporte {
    const recibido = msDeIso(r.acuse.recibidoEn) ?? 0;
    const confirmado = this.opciones.ahora().getTime() - recibido >= this.opciones.confirmarTrasMs;
    return { ...r.acuse, confirmado };
  }

  private confirmadoEn(r: Recibido): string {
    const recibido = msDeIso(r.acuse.recibidoEn) ?? 0;
    return ahoraIsoUtc(new Date(recibido + this.opciones.confirmarTrasMs));
  }
}
