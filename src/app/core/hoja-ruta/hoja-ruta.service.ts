import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ahoraIsoUtc, fechaHoraNegocio } from '../../shared/utils/zona-negocio.util';
import { HojaRuta } from '../api/operador-api-m2.modelos';
import { IsoUtc } from '../api/operador-api.modelos';
import { OPERADOR_API, comoErrorApi } from '../api/operador-api';
import { ConexionService } from '../conexion/conexion.service';
import { ALMACEN_LOCAL, PREFIJO_CLAVES, RELOJ } from '../plataforma';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';

export const claveCopiaHojaRuta = (operadorId: string) => `${PREFIJO_CLAVES}hoja-ruta.v1.${operadorId}`;

interface CopiaHojaRuta {
  guardadaEn: IsoUtc;
  hojaRuta: HojaRuta | null;
}

export type EstadoHojaRuta = 'inicial' | 'cargando' | 'listo' | 'error';

function esCopiaValida(c: unknown): c is CopiaHojaRuta {
  const x = c as CopiaHojaRuta | null;
  if (!x || typeof x.guardadaEn !== 'string' || !('hojaRuta' in x)) return false;
  return x.hojaRuta === null || (typeof x.hojaRuta.folio === 'string' && Array.isArray(x.hojaRuta.itinerario));
}

/**
 * Hoja de ruta de la salida activa (contrato M2, sección 1). Se guarda en el teléfono para verla sin señal y se vuelve
 * a pedir al recuperar la señal (la oficina puede cambiar paradas o casetas). La copia se borra al cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class HojaRutaService {
  private readonly api = inject(OPERADOR_API);
  private readonly sesion = inject(AlmacenSesion);
  private readonly almacen = inject(ALMACEN_LOCAL);
  private readonly reloj = inject(RELOJ);

  private readonly estadoSig = signal<EstadoHojaRuta>('inicial');
  private readonly hojaSig = signal<HojaRuta | null>(null);
  private readonly guardadaEnSig = signal<IsoUtc | null>(null);
  private readonly desdeCopiaSig = signal(false);
  private readonly errorSig = signal<string | null>(null);
  private operadorCargado: string | null = null;
  private enCurso: Promise<void> | null = null;

  readonly estado = this.estadoSig.asReadonly();
  /** null = sin salida activa (o aún sin cargar: ver `estado`). */
  readonly hojaRuta = this.hojaSig.asReadonly();
  /** Cuándo se guardó en el teléfono lo que se muestra. */
  readonly guardadaEn = this.guardadaEnSig.asReadonly();
  /** true = se muestra la copia guardada porque no se pudo consultar: puede no estar al día. */
  readonly desdeCopia = this.desdeCopiaSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  constructor() {
    // Al volver la señal se vuelve a pedir (si ya se había consultado para este operador).
    const baja = inject(ConexionService).alRecuperar(() => {
      if (this.operadorCargado && this.operadorCargado === this.sesion.operadorId()) void this.cargar();
    });
    inject(DestroyRef).onDestroy(baja);
  }

  async asegurar(): Promise<void> {
    if (this.operadorCargado !== this.sesion.operadorId() || this.estadoSig() === 'inicial') await this.cargar();
  }

  cargar(): Promise<void> {
    this.enCurso ??= this.consultar().finally(() => (this.enCurso = null));
    return this.enCurso;
  }

  /** Al cerrar sesión: borra la copia del teléfono y lo que hay en memoria. */
  olvidar(operadorId: string | null): void {
    if (operadorId) this.almacen.removeItem(claveCopiaHojaRuta(operadorId));
    this.reiniciar();
    this.operadorCargado = null;
  }

  private async consultar(): Promise<void> {
    const operadorId = this.sesion.operadorId();
    if (!operadorId) return;
    if (this.operadorCargado !== operadorId) this.reiniciar();
    this.operadorCargado = operadorId;
    if (this.estadoSig() === 'inicial') this.usarCopia(operadorId); // mientras llega, lo guardado
    this.estadoSig.set('cargando');
    try {
      const hojaRuta = await this.api.obtenerHojaRuta();
      if (this.sesion.operadorId() !== operadorId) return;
      const guardadaEn = ahoraIsoUtc(this.reloj());
      this.hojaSig.set(hojaRuta);
      this.guardadaEnSig.set(guardadaEn);
      this.desdeCopiaSig.set(false);
      this.errorSig.set(null);
      this.estadoSig.set('listo');
      this.guardarCopia(operadorId, { guardadaEn, hojaRuta });
    } catch (e) {
      if (this.sesion.operadorId() !== operadorId) return;
      if (comoErrorApi(e).tipo === 'sesion') {
        this.sesion.vencer(MENSAJE_SESION_VENCIDA);
        return;
      }
      const hayCopia = this.guardadaEnSig() != null || this.usarCopia(operadorId);
      this.desdeCopiaSig.set(hayCopia);
      this.estadoSig.set(hayCopia ? 'listo' : 'error');
      this.errorSig.set(
        hayCopia
          ? `Sin conexión con la oficina. Se muestra la hoja guardada el ${fechaHoraNegocio(this.guardadaEnSig())}; puede no estar al día (la oficina pudo cambiar paradas o casetas).`
          : 'No se pudo cargar la hoja de ruta. Revise su señal e intente de nuevo.',
      );
    }
  }

  private reiniciar(): void {
    this.hojaSig.set(null);
    this.guardadaEnSig.set(null);
    this.desdeCopiaSig.set(false);
    this.errorSig.set(null);
    this.estadoSig.set('inicial');
  }

  private usarCopia(operadorId: string): boolean {
    try {
      const copia: unknown = JSON.parse(this.almacen.getItem(claveCopiaHojaRuta(operadorId)) ?? 'null');
      if (!esCopiaValida(copia)) return false;
      this.hojaSig.set(copia.hojaRuta);
      this.guardadaEnSig.set(copia.guardadaEn);
      this.desdeCopiaSig.set(true);
      return true;
    } catch {
      return false;
    }
  }

  private guardarCopia(operadorId: string, copia: CopiaHojaRuta): void {
    try {
      this.almacen.setItem(claveCopiaHojaRuta(operadorId), JSON.stringify(copia));
    } catch {
      // Sin espacio: la app sigue, solo que sin copia para ver sin señal.
    }
  }
}
