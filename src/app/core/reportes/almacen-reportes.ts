import { InjectionToken } from '@angular/core';
import { normalizarReporteLocal } from '../../shared/utils/cola-reportes.util';
import { TABLA_REPORTES, abrirBaseDatos, comoPromesa, transaccionTerminada } from '../almacen/base-datos';
import { ReporteLocal } from './reporte-local';

export { NOMBRE_BD, TABLA_REPORTES, VERSION_BD } from '../almacen/base-datos';

/** Dónde vive la cola de reportes en el teléfono. */
export interface AlmacenReportes {
  /** false = no hay IndexedDB (p. ej. navegación privada): los reportes se pierden al cerrar la app. */
  readonly persistente: boolean;
  todos(): Promise<ReporteLocal[]>;
  /** Inserta o reemplaza por id. */
  guardar(reporte: ReporteLocal): Promise<void>;
  /** Quita un registro (p. ej. al cambiarle el id porque otro operador ya lo usó). */
  eliminar(id: string): Promise<void>;
}

export class AlmacenReportesMemoria implements AlmacenReportes {
  readonly persistente: boolean = false;
  private readonly datos = new Map<string, ReporteLocal>();

  async todos(): Promise<ReporteLocal[]> {
    return [...this.datos.values()].map((r) => structuredClone(r));
  }

  async guardar(reporte: ReporteLocal): Promise<void> {
    this.datos.set(reporte.id, structuredClone(reporte));
  }

  async eliminar(id: string): Promise<void> {
    this.datos.delete(id);
  }
}

/**
 * Cola en IndexedDB (sobrevive a cerrar la app y a reiniciar el teléfono). Si IndexedDB no abre, sigue en memoria
 * para no perder el reporte en curso.
 */
export class AlmacenReportesIndexedDb implements AlmacenReportes {
  private bd: Promise<IDBDatabase | null> | null = null;
  private respaldo: AlmacenReportesMemoria | null = null;

  constructor(
    private readonly idb: IDBFactory,
    private readonly nombreBd?: string,
  ) {}

  get persistente(): boolean {
    return this.respaldo == null;
  }

  async todos(): Promise<ReporteLocal[]> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.todos();
    const tx = bd.transaction(TABLA_REPORTES, 'readonly');
    const todos = await comoPromesa(tx.objectStore(TABLA_REPORTES).getAll() as IDBRequest<unknown[]>);
    // Registros de versiones anteriores se traducen; los dañados se ignoran.
    return todos.map(normalizarReporteLocal).filter((r): r is ReporteLocal => !!r);
  }

  async guardar(reporte: ReporteLocal): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.guardar(reporte);
    const tx = bd.transaction(TABLA_REPORTES, 'readwrite');
    tx.objectStore(TABLA_REPORTES).put(reporte);
    await transaccionTerminada(tx);
  }

  async eliminar(id: string): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.eliminar(id);
    const tx = bd.transaction(TABLA_REPORTES, 'readwrite');
    tx.objectStore(TABLA_REPORTES).delete(id);
    await transaccionTerminada(tx);
  }

  private abrir(): Promise<IDBDatabase | null> {
    this.bd ??= abrirBaseDatos(this.idb, this.nombreBd).catch(() => {
      this.respaldo = new AlmacenReportesMemoria();
      return null;
    });
    return this.bd;
  }
}

export const ALMACEN_REPORTES = new InjectionToken<AlmacenReportes>('ALMACEN_REPORTES', {
  providedIn: 'root',
  factory: () => (typeof indexedDB !== 'undefined' ? new AlmacenReportesIndexedDb(indexedDB) : new AlmacenReportesMemoria()),
});
