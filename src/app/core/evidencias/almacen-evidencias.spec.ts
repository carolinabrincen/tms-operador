import { IDBFactory } from 'fake-indexeddb';
import { NOMBRE_BD, TABLA_CREDENCIALES, TABLA_REPORTES, VERSION_BD } from '../almacen/base-datos';
import { AlmacenReportesIndexedDb } from '../reportes/almacen-reportes';
import { AlmacenCredencialesIndexedDb } from '../sesion/almacen-credenciales';
import { crearEvidenciaLocal } from '../../shared/utils/evidencias.util';
import { AlmacenEvidenciasIndexedDb } from './almacen-evidencias';

const foto = (id: string) =>
  crearEvidenciaLocal(
    { id, viajeId: 'v1', tipo: 'Sellos', descripcion: null, nota: null, reporteId: null, tomadaEn: null, ubicacion: null },
    'op1',
    'Viaje 1',
    new Uint8Array([0xff, 0xd8, 0xff, 9]).buffer,
    'image/jpeg',
    '2026-11-24T16:00:00Z',
  );

describe('AlmacenEvidencias: la cola de fotos en IndexedDB', () => {
  it('guarda la foto como bytes y la recupera igual', async () => {
    const idb = new IDBFactory();
    await new AlmacenEvidenciasIndexedDb(idb).guardar(foto('a'));
    const [leida] = await new AlmacenEvidenciasIndexedDb(idb).todas();
    expect(leida.id).toBe('a');
    expect([...new Uint8Array(leida.foto!)]).toEqual([0xff, 0xd8, 0xff, 9]);
    await new AlmacenEvidenciasIndexedDb(idb).eliminar('a');
    expect(await new AlmacenEvidenciasIndexedDb(idb).todas()).toEqual([]);
  });

  it('pasar de la base del paso 3 (versión 3) a la 4 conserva la cola de reportes y las credenciales', async () => {
    expect(VERSION_BD).toBe(4);
    const idb = new IDBFactory();
    await new Promise<void>((listo) => {
      const req = idb.open(NOMBRE_BD, 3);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(TABLA_REPORTES, { keyPath: 'id' }).put({
          id: 'r1',
          operadorId: 'op1',
          reporte: { tipo: 'estatus', id: 'r1', viajeId: 'v1', estatus: 'EnCarga', ocurrioEn: 't', ubicacion: null, nota: null },
          resumen: 'Viaje 1',
          estado: 'pendiente',
          resultado: null,
          mensaje: null,
          creadoEn: 't',
          intentos: 0,
          ultimoIntentoEn: null,
          enviadoEn: null,
          confirmadoEn: null,
          error: null,
        });
        req.result.createObjectStore(TABLA_CREDENCIALES).put({ token: 't', expiraEn: 'x', refreshToken: 'r', refreshExpiraEn: 'y' }, 'actual');
      };
      req.onsuccess = () => (req.result.close(), listo());
    });
    await new AlmacenEvidenciasIndexedDb(idb).guardar(foto('f1'));
    expect((await new AlmacenReportesIndexedDb(idb).todos()).map((r) => r.id)).toEqual(['r1']);
    expect((await new AlmacenCredencialesIndexedDb(idb).leer())?.refreshToken).toBe('r');
    expect((await new AlmacenEvidenciasIndexedDb(idb).todas()).map((f) => f.id)).toEqual(['f1']);
  });
});
