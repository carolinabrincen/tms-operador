import { InjectionToken } from '@angular/core';
import { ReporteLocal } from './reporte-local';

/** Dónde vive la cola de reportes en el teléfono. */
export interface AlmacenReportes {
  /** false = no hay IndexedDB (p. ej. navegación privada): los reportes se pierden al cerrar la app. */
  readonly persistente: boolean;
  todos(): Promise<ReporteLocal[]>;
  /** Inserta o reemplaza por id. */
  guardar(reporte: ReporteLocal): Promise<void>;
}

export const NOMBRE_BD = 'ct-operador';
export const VERSION_BD = 1;
export const TABLA_REPORTES = 'reportes';

export class AlmacenReportesMemoria implements AlmacenReportes {
  readonly persistente: boolean = false;
  private readonly datos = new Map<string, ReporteLocal>();

  async todos(): Promise<ReporteLocal[]> {
    return [...this.datos.values()].map((r) => structuredClone(r));
  }

  async guardar(reporte: ReporteLocal): Promise<void> {
    this.datos.set(reporte.id, structuredClone(reporte));
  }
}

const comoPromesa = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolver, rechazar) => {
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });

/**
 * Cola en IndexedDB (sobrevive a cerrar la app y a reiniciar el teléfono). Si IndexedDB no abre, sigue en memoria
 * para no perder el reporte en curso.
 */
export class AlmacenReportesIndexedDb implements AlmacenReportes {
  private bd: Promise<IDBDatabase | null> | null = null;
  private respaldo: AlmacenReportesMemoria | null = null;

  constructor(
    private readonly idb: IDBFactory,
    private readonly nombreBd = NOMBRE_BD,
  ) {}

  get persistente(): boolean {
    return this.respaldo == null;
  }

  async todos(): Promise<ReporteLocal[]> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.todos();
    const tx = bd.transaction(TABLA_REPORTES, 'readonly');
    return comoPromesa(tx.objectStore(TABLA_REPORTES).getAll() as IDBRequest<ReporteLocal[]>);
  }

  async guardar(reporte: ReporteLocal): Promise<void> {
    const bd = await this.abrir();
    if (!bd) return this.respaldo!.guardar(reporte);
    const tx = bd.transaction(TABLA_REPORTES, 'readwrite');
    tx.objectStore(TABLA_REPORTES).put(reporte);
    // Se espera a que la transacción quede escrita (no solo la petición).
    await new Promise<void>((resolver, rechazar) => {
      tx.oncomplete = () => resolver();
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error);
    });
  }

  private abrir(): Promise<IDBDatabase | null> {
    this.bd ??= new Promise<IDBDatabase | null>((resolver) => {
      let req: IDBOpenDBRequest;
      try {
        req = this.idb.open(this.nombreBd, VERSION_BD);
      } catch {
        this.respaldo = new AlmacenReportesMemoria();
        resolver(null);
        return;
      }
      req.onupgradeneeded = () => {
        const bd = req.result;
        if (!bd.objectStoreNames.contains(TABLA_REPORTES)) bd.createObjectStore(TABLA_REPORTES, { keyPath: 'id' });
      };
      req.onsuccess = () => resolver(req.result);
      req.onerror = () => {
        this.respaldo = new AlmacenReportesMemoria();
        resolver(null);
      };
    });
    return this.bd;
  }
}

export const ALMACEN_REPORTES = new InjectionToken<AlmacenReportes>('ALMACEN_REPORTES', {
  providedIn: 'root',
  factory: () => (typeof indexedDB !== 'undefined' ? new AlmacenReportesIndexedDb(indexedDB) : new AlmacenReportesMemoria()),
});
