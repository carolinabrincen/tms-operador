import { InjectionToken } from '@angular/core';
import { TABLA_CREDENCIALES, abrirBaseDatos, comoPromesa, transaccionTerminada } from '../almacen/base-datos';
import type { Credenciales } from '../api/http/mapeo-api.util';

/**
 * Token y refresh de la sesión real (contrato M1: el refresh se guarda en IndexedDB; el token va con él para no gastar
 * una renovación cada vez que se abre la app). Solo los usa OperadorApiHttp. Nunca se imprimen ni salen en errores.
 */
export interface AlmacenCredenciales {
  leer(): Promise<Credenciales | null>;
  guardar(c: Credenciales): Promise<void>;
  borrar(): Promise<void>;
}

const LLAVE = 'actual';

function validas(v: unknown): v is Credenciales {
  const c = v as Credenciales | null;
  return !!c && typeof c.token === 'string' && typeof c.refreshToken === 'string' && typeof c.expiraEn === 'string' && typeof c.refreshExpiraEn === 'string';
}

export class AlmacenCredencialesMemoria implements AlmacenCredenciales {
  private c: Credenciales | null = null;
  async leer(): Promise<Credenciales | null> {
    return this.c ? { ...this.c } : null;
  }
  async guardar(c: Credenciales): Promise<void> {
    this.c = { ...c };
  }
  async borrar(): Promise<void> {
    this.c = null;
  }
}

export class AlmacenCredencialesIndexedDb implements AlmacenCredenciales {
  private bd: Promise<IDBDatabase | null> | null = null;
  private respaldo: AlmacenCredencialesMemoria | null = null;

  constructor(
    private readonly idb: IDBFactory,
    private readonly nombreBd?: string,
  ) {}

  async leer(): Promise<Credenciales | null> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.leer();
    const tx = bd.transaction(TABLA_CREDENCIALES, 'readonly');
    const v = await comoPromesa(tx.objectStore(TABLA_CREDENCIALES).get(LLAVE));
    return validas(v) ? v : null;
  }

  async guardar(c: Credenciales): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.guardar(c);
    const tx = bd.transaction(TABLA_CREDENCIALES, 'readwrite');
    // Solo estos cuatro campos.
    tx.objectStore(TABLA_CREDENCIALES).put({ token: c.token, expiraEn: c.expiraEn, refreshToken: c.refreshToken, refreshExpiraEn: c.refreshExpiraEn }, LLAVE);
    await transaccionTerminada(tx);
  }

  async borrar(): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.borrar();
    const tx = bd.transaction(TABLA_CREDENCIALES, 'readwrite');
    tx.objectStore(TABLA_CREDENCIALES).delete(LLAVE);
    await transaccionTerminada(tx);
  }

  private abrir(): Promise<IDBDatabase | null> {
    this.bd ??= abrirBaseDatos(this.idb, this.nombreBd).catch(() => {
      this.respaldo = new AlmacenCredencialesMemoria();
      return null;
    });
    return this.bd;
  }
}

export const ALMACEN_CREDENCIALES = new InjectionToken<AlmacenCredenciales>('ALMACEN_CREDENCIALES', {
  providedIn: 'root',
  factory: () => (typeof indexedDB !== 'undefined' ? new AlmacenCredencialesIndexedDb(indexedDB) : new AlmacenCredencialesMemoria()),
});
