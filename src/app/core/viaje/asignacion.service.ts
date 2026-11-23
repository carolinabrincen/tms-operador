import { Injectable, inject, signal } from '@angular/core';
import { fechaHoraNegocio, ahoraIsoUtc } from '../../shared/utils/zona-negocio.util';
import { OPERADOR_API, comoErrorApi } from '../api/operador-api';
import { AsignacionOperador, IsoUtc } from '../api/operador-api.modelos';
import { ALMACEN_LOCAL, PREFIJO_CLAVES, RELOJ } from '../plataforma';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';

/** v2 = paso 2 (salida con viajes). La copia del paso 1 (formato anterior) se ignora. */
export const claveCopiaAsignacion = (operadorId: string) => `${PREFIJO_CLAVES}asignacion.v2.${operadorId}`;

interface CopiaAsignacion {
  guardadaEn: IsoUtc;
  asignacion: AsignacionOperador;
}

export type EstadoCarga = 'inicial' | 'cargando' | 'listo' | 'error';

function esCopiaValida(c: unknown): c is CopiaAsignacion {
  const x = c as CopiaAsignacion | null;
  if (!x || typeof x.guardadaEn !== 'string' || !x.asignacion || !('salida' in x.asignacion)) return false;
  return x.asignacion.salida === null || Array.isArray(x.asignacion.salida.viajes);
}

/**
 * Lo asignado al operador: la salida con sus viajes, su estatus actual e historial. Guarda una copia en el teléfono
 * para poder ver el viaje sin señal; la copia se borra al cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class AsignacionService {
  private readonly api = inject(OPERADOR_API);
  private readonly sesion = inject(AlmacenSesion);
  private readonly almacen = inject(ALMACEN_LOCAL);
  private readonly reloj = inject(RELOJ);

  private readonly estadoSig = signal<EstadoCarga>('inicial');
  private readonly asignacionSig = signal<AsignacionOperador | null>(null);
  private readonly actualizadaEnSig = signal<IsoUtc | null>(null);
  private readonly desdeCopiaSig = signal(false);
  private readonly errorSig = signal<string | null>(null);
  private operadorCargado: string | null = null;
  private enCurso: Promise<void> | null = null;

  readonly estado = this.estadoSig.asReadonly();
  readonly asignacion = this.asignacionSig.asReadonly();
  readonly actualizadaEn = this.actualizadaEnSig.asReadonly();
  /** true = se muestra la copia guardada porque no se pudo consultar. */
  readonly desdeCopia = this.desdeCopiaSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  /** Carga si aún no se ha cargado para este operador. */
  async asegurar(): Promise<void> {
    if (this.operadorCargado !== this.sesion.operadorId() || this.estadoSig() === 'inicial') await this.cargar();
  }

  /** Consulta al servidor. Si ya hay una consulta en curso, espera esa misma. */
  cargar(): Promise<void> {
    this.enCurso ??= this.consultar().finally(() => (this.enCurso = null));
    return this.enCurso;
  }

  private async consultar(): Promise<void> {
    const operadorId = this.sesion.operadorId();
    if (!operadorId) return;
    if (this.operadorCargado !== operadorId) this.reiniciar();
    this.operadorCargado = operadorId;
    // Mientras llega la respuesta se muestra la copia (si hay), para no dejar la pantalla vacía con mala señal.
    if (!this.asignacionSig()) this.usarCopia(operadorId);
    this.estadoSig.set('cargando');
    try {
      const asignacion = await this.api.obtenerAsignacion();
      if (this.sesion.operadorId() !== operadorId) return;
      const guardadaEn = ahoraIsoUtc(this.reloj());
      this.asignacionSig.set(asignacion);
      this.actualizadaEnSig.set(guardadaEn);
      this.desdeCopiaSig.set(false);
      this.errorSig.set(null);
      this.estadoSig.set('listo');
      this.guardarCopia(operadorId, { guardadaEn, asignacion });
    } catch (e) {
      if (this.sesion.operadorId() !== operadorId) return;
      const error = comoErrorApi(e);
      if (error.tipo === 'sesion') {
        this.sesion.vencer(MENSAJE_SESION_VENCIDA);
        return;
      }
      const hayCopia = this.asignacionSig() != null || this.usarCopia(operadorId);
      this.estadoSig.set(hayCopia ? 'listo' : 'error');
      this.errorSig.set(
        hayCopia
          ? `Sin conexión con la oficina. Se muestra lo guardado el ${fechaHoraNegocio(this.actualizadaEnSig())}.`
          : 'No se pudo cargar su viaje. Revise su señal e intente de nuevo.',
      );
    }
  }

  /** Al cerrar sesión: borra la copia del teléfono y lo que hay en memoria. */
  olvidar(operadorId: string | null): void {
    if (operadorId) this.almacen.removeItem(claveCopiaAsignacion(operadorId));
    this.reiniciar();
    this.operadorCargado = null;
  }

  private reiniciar(): void {
    this.asignacionSig.set(null);
    this.actualizadaEnSig.set(null);
    this.desdeCopiaSig.set(false);
    this.errorSig.set(null);
    this.estadoSig.set('inicial');
  }

  private usarCopia(operadorId: string): boolean {
    try {
      const copia: unknown = JSON.parse(this.almacen.getItem(claveCopiaAsignacion(operadorId)) ?? 'null');
      if (!esCopiaValida(copia)) return false;
      this.asignacionSig.set(copia.asignacion);
      this.actualizadaEnSig.set(copia.guardadaEn);
      this.desdeCopiaSig.set(true);
      return true;
    } catch {
      return false;
    }
  }

  private guardarCopia(operadorId: string, copia: CopiaAsignacion): void {
    try {
      this.almacen.setItem(claveCopiaAsignacion(operadorId), JSON.stringify(copia));
    } catch {
      // Sin espacio: la app sigue, solo que sin copia para ver sin señal.
    }
  }
}
