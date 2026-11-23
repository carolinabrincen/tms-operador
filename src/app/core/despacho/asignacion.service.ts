import { Injectable, inject, signal } from '@angular/core';
import { fechaHoraNegocio, ahoraIsoUtc } from '../../shared/utils/zona-negocio.util';
import { OPERADOR_API, comoErrorApi } from '../api/operador-api';
import { AsignacionOperador, IsoUtc } from '../api/operador-api.modelos';
import { ALMACEN_LOCAL, PREFIJO_CLAVES, RELOJ } from '../plataforma';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';

export const claveCopiaAsignacion = (operadorId: string) => `${PREFIJO_CLAVES}asignacion.${operadorId}`;

interface CopiaAsignacion {
  guardadaEn: IsoUtc;
  asignacion: AsignacionOperador;
}

export type EstadoCarga = 'inicial' | 'cargando' | 'listo' | 'error';

/**
 * Lo asignado al operador (despacho activo y movimientos en vacío). Guarda una copia en el teléfono para poder ver el
 * despacho sin señal; la copia se borra al cerrar sesión.
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

  async cargar(): Promise<void> {
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
          : 'No se pudo cargar su despacho. Revise su señal e intente de nuevo.',
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
      const copia = JSON.parse(this.almacen.getItem(claveCopiaAsignacion(operadorId)) ?? 'null') as CopiaAsignacion | null;
      if (!copia?.asignacion || !Array.isArray(copia.asignacion.movimientosVacio)) return false;
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
