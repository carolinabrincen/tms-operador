import { InjectionToken } from '@angular/core';
import { normalizarEvidenciaLocal } from '../../shared/utils/evidencias.util';
import { TABLA_EVIDENCIAS, abrirBaseDatos, comoPromesa, transaccionTerminada } from '../almacen/base-datos';
import { EvidenciaLocal } from './evidencia-local';

/** Dónde vive la cola de fotos en el teléfono. */
export interface AlmacenEvidencias {
  /** false = no hay IndexedDB (p. ej. navegación privada): las fotos se pierden al cerrar la app. */
  readonly persistente: boolean;
  todas(): Promise<EvidenciaLocal[]>;
  /** Inserta o reemplaza por id. */
  guardar(e: EvidenciaLocal): Promise<void>;
  eliminar(id: string): Promise<void>;
}

export class AlmacenEvidenciasMemoria implements AlmacenEvidencias {
  readonly persistente: boolean = false;
  private readonly datos = new Map<string, EvidenciaLocal>();

  async todas(): Promise<EvidenciaLocal[]> {
    return [...this.datos.values()].map((e) => structuredClone(e));
  }

  async guardar(e: EvidenciaLocal): Promise<void> {
    this.datos.set(e.id, structuredClone(e));
  }

  async eliminar(id: string): Promise<void> {
    this.datos.delete(id);
  }
}

/** Cola de fotos en IndexedDB (la misma base que los reportes). Si no abre, sigue en memoria. */
export class AlmacenEvidenciasIndexedDb implements AlmacenEvidencias {
  private bd: Promise<IDBDatabase | null> | null = null;
  private respaldo: AlmacenEvidenciasMemoria | null = null;

  constructor(
    private readonly idb: IDBFactory,
    private readonly nombreBd?: string,
  ) {}

  get persistente(): boolean {
    return this.respaldo == null;
  }

  async todas(): Promise<EvidenciaLocal[]> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.todas();
    const tx = bd.transaction(TABLA_EVIDENCIAS, 'readonly');
    const todas = await comoPromesa(tx.objectStore(TABLA_EVIDENCIAS).getAll() as IDBRequest<unknown[]>);
    return todas.map(normalizarEvidenciaLocal).filter((e): e is EvidenciaLocal => !!e);
  }

  async guardar(e: EvidenciaLocal): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.guardar(e);
    const tx = bd.transaction(TABLA_EVIDENCIAS, 'readwrite');
    tx.objectStore(TABLA_EVIDENCIAS).put(e);
    await transaccionTerminada(tx);
  }

  async eliminar(id: string): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.eliminar(id);
    const tx = bd.transaction(TABLA_EVIDENCIAS, 'readwrite');
    tx.objectStore(TABLA_EVIDENCIAS).delete(id);
    await transaccionTerminada(tx);
  }

  private abrir(): Promise<IDBDatabase | null> {
    this.bd ??= abrirBaseDatos(this.idb, this.nombreBd).catch(() => {
      this.respaldo = new AlmacenEvidenciasMemoria();
      return null;
    });
    return this.bd;
  }
}

export const ALMACEN_EVIDENCIAS = new InjectionToken<AlmacenEvidencias>('ALMACEN_EVIDENCIAS', {
  providedIn: 'root',
  factory: () => (typeof indexedDB !== 'undefined' ? new AlmacenEvidenciasIndexedDb(indexedDB) : new AlmacenEvidenciasMemoria()),
});
