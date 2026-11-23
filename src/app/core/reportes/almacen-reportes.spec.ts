import { IDBFactory } from 'fake-indexeddb';
import { crearReporteLocal } from '../../shared/utils/cola-reportes.util';
import { AlmacenReportesIndexedDb, AlmacenReportesMemoria } from './almacen-reportes';

const r = (id: string) =>
  crearReporteLocal(
    { id, objetivo: { tipo: 'movimiento', movimientoId: 'm' }, avance: 'sali', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null },
    'op1',
    'Mov',
    '2026-11-23T16:00:00Z',
  );

describe('AlmacenReportes: la cola en el teléfono', () => {
  it('IndexedDB: guarda, reemplaza por id y persiste entre aperturas', async () => {
    const idb = new IDBFactory();
    const a = new AlmacenReportesIndexedDb(idb);
    await a.guardar(r('1'));
    await a.guardar(r('2'));
    await a.guardar({ ...r('1'), estado: 'enviado' });
    const otraApertura = new AlmacenReportesIndexedDb(idb);
    const todos = (await otraApertura.todos()).sort((x, y) => x.id.localeCompare(y.id));
    expect(todos.map((x) => [x.id, x.estado])).toEqual([
      ['1', 'enviado'],
      ['2', 'pendiente'],
    ]);
    expect(otraApertura.persistente).toBe(true);
  });

  it('si IndexedDB no abre, sigue en memoria (no pierde el reporte en curso) y avisa que no es persistente', async () => {
    const roto = { open: () => { throw new Error('bloqueado'); } } as unknown as IDBFactory;
    const a = new AlmacenReportesIndexedDb(roto);
    await a.guardar(r('1'));
    expect((await a.todos()).map((x) => x.id)).toEqual(['1']);
    expect(a.persistente).toBe(false);
  });

  it('memoria: guarda copias (cambiar el objeto después no altera lo guardado)', async () => {
    const m = new AlmacenReportesMemoria();
    const x = r('1');
    await m.guardar(x);
    x.estado = 'confirmado';
    expect((await m.todos())[0].estado).toBe('pendiente');
    expect(m.persistente).toBe(false);
  });
});
