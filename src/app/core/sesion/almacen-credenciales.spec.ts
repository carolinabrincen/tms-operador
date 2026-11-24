import { IDBFactory } from 'fake-indexeddb';
import { NOMBRE_BD, TABLA_REPORTES, VERSION_BD } from '../almacen/base-datos';
import { AlmacenReportesIndexedDb } from '../reportes/almacen-reportes';
import { AlmacenCredencialesIndexedDb, AlmacenCredencialesMemoria } from './almacen-credenciales';

const CRED = { token: 't', expiraEn: '2026-11-23T21:05:00Z', refreshToken: 'r', refreshExpiraEn: '2026-12-23T20:05:00Z' };

describe('AlmacenCredenciales: token y refresh en IndexedDB', () => {
  it('guarda, lee (también desde otra apertura) y borra; solo los cuatro campos', async () => {
    const idb = new IDBFactory();
    const a = new AlmacenCredencialesIndexedDb(idb);
    expect(await a.leer()).toBeNull();
    await a.guardar({ ...CRED, pin: '123456' } as never);
    expect(await new AlmacenCredencialesIndexedDb(idb).leer()).toEqual(CRED);
    await a.borrar();
    expect(await a.leer()).toBeNull();
  });

  it('si IndexedDB no abre, funciona en memoria', async () => {
    const roto = { open: () => { throw new Error('bloqueado'); } } as unknown as IDBFactory;
    const a = new AlmacenCredencialesIndexedDb(roto);
    await a.guardar(CRED);
    expect(await a.leer()).toEqual(CRED);
  });

  it('memoria: copia, no referencia', async () => {
    const m = new AlmacenCredencialesMemoria();
    const c = { ...CRED };
    await m.guardar(c);
    c.token = 'cambiado';
    expect((await m.leer())!.token).toBe('t');
  });

  it('pasar de la base del paso 2 (versión 2) a la 3 conserva la cola de reportes', async () => {
    expect(VERSION_BD).toBe(3);
    const idb = new IDBFactory();
    await new Promise<void>((listo) => {
      const req = idb.open(NOMBRE_BD, 2);
      req.onupgradeneeded = () =>
        req.result.createObjectStore(TABLA_REPORTES, { keyPath: 'id' }).put({
          id: 'r1',
          operadorId: 'op1',
          reporte: { tipo: 'estatus', id: 'r1', viajeId: 'v1', estatus: 'EnCarga', ocurrioEn: 't', ubicacion: null, nota: null },
          resumen: 'Viaje 1',
          estado: 'pendiente',
          creadoEn: 't',
          intentos: 0,
          ultimoIntentoEn: null,
          enviadoEn: null,
          confirmadoEn: null,
          error: null,
          aviso: null,
        });
      req.onsuccess = () => (req.result.close(), listo());
    });
    await new AlmacenCredencialesIndexedDb(idb).guardar(CRED);
    expect((await new AlmacenReportesIndexedDb(idb).todos()).map((r) => r.id)).toEqual(['r1']);
  });
});
