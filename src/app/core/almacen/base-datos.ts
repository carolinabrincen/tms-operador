/**
 * Base IndexedDB de la app (una sola, con tres almacenes):
 *  - reportes: la cola de reportes (llave: id del reporte).
 *  - credenciales: token y refresh de la sesión (una sola fila, llave "actual"). Contrato M1: el refresh va en IndexedDB.
 *  - evidencias: la cola de fotos, con la foto ya reducida (llave: id de la evidencia). Contrato M2.
 *
 * Versiones: 1 = paso 1 (formato viejo, solo ejemplo); 2 = paso 2; 3 = paso 3 (agrega credenciales); 4 = M2 (agrega
 * evidencias; lo anterior se conserva).
 */

export const NOMBRE_BD = 'ct-operador';
export const VERSION_BD = 4;
export const TABLA_REPORTES = 'reportes';
export const TABLA_CREDENCIALES = 'credenciales';
export const TABLA_EVIDENCIAS = 'evidencias';

export const comoPromesa = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolver, rechazar) => {
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });

/** Espera a que una transacción quede escrita. */
export const transaccionTerminada = (tx: IDBTransaction) =>
  new Promise<void>((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });

/** Abre (y crea o actualiza) la base. Rechaza si IndexedDB no está disponible. */
export function abrirBaseDatos(idb: IDBFactory, nombre = NOMBRE_BD): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolver, rechazar) => {
    let req: IDBOpenDBRequest;
    try {
      req = idb.open(nombre, VERSION_BD);
    } catch (e) {
      rechazar(e);
      return;
    }
    req.onupgradeneeded = (ev) => {
      const bd = req.result;
      // Versión 1 (paso 1): formato anterior y solo datos de ejemplo; se empieza de cero.
      if (ev.oldVersion < 2 && bd.objectStoreNames.contains(TABLA_REPORTES)) bd.deleteObjectStore(TABLA_REPORTES);
      if (!bd.objectStoreNames.contains(TABLA_REPORTES)) bd.createObjectStore(TABLA_REPORTES, { keyPath: 'id' });
      if (!bd.objectStoreNames.contains(TABLA_CREDENCIALES)) bd.createObjectStore(TABLA_CREDENCIALES);
      if (!bd.objectStoreNames.contains(TABLA_EVIDENCIAS)) bd.createObjectStore(TABLA_EVIDENCIAS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
    // Otra pestaña con una versión vieja abierta: se espera a que la cierre (onsuccess llega después).
    req.onblocked = () => undefined;
  });
}
