import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../api/ejemplo/operador-api-ejemplo';
import { ErrorApiOperador, OPERADOR_API } from '../api/operador-api';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';
import { EstatusViaje } from '../api/operador-api.modelos';
import { FORMATO_UUID_V4 } from '../../shared/utils/id-reporte.util';
import { EntornoPruebas, configurar, crearEntorno, entrarComo, ponerEnLinea } from '../../testing/entorno-pruebas';
import { AlmacenReportesIndexedDb } from './almacen-reportes';
import { ColaReportesService, NuevoReporte } from './cola-reportes.service';

/** Reporte de estatus sobre el viaje 2 (cargado) del ejemplo. */
function nuevo(estatus: EstatusViaje = 'EnPosicionamiento', viajeId = 'ej-via-771'): NuevoReporte {
  return {
    tipo: 'estatus',
    viajeId,
    estatus,
    ocurrioEn: '2026-11-23T16:00:00Z',
    ubicacion: { lat: 25.68, lng: -100.31, precisionM: 10, tomadoEn: '2026-11-23T16:00:00Z' },
    nota: '  Todo bien  ',
    resumen: 'Viaje 2',
  };
}

describe('ColaReportesService: guardar primero, enviar después, reintentar sin duplicar', () => {
  let e: EntornoPruebas;
  let cola: ColaReportesService;
  let api: OperadorApiEjemplo;

  async function iniciar(previo?: Partial<EntornoPruebas>) {
    e = crearEntorno(previo);
    configurar(e);
    api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    await entrarComo();
    cola = TestBed.inject(ColaReportesService);
    await cola.listo();
  }

  /** Lo que hay en IndexedDB, leído con una conexión aparte. */
  const enDisco = () => new AlmacenReportesIndexedDb(e.idb).todos();

  beforeEach(async () => iniciar());

  it('con señal: guarda, envía y queda "enviado"; el id es un UUID generado en el teléfono; la nota se recorta', async () => {
    const r = await cola.registrar(nuevo());
    expect(r.id).toMatch(FORMATO_UUID_V4);
    expect(r.reporte.nota).toBe('Todo bien');
    await cola.inactivo();
    expect(api.totalRecibidos).toBe(1);
    expect(cola.reportes()[0]).toMatchObject({ id: r.id, estado: 'enviado', intentos: 1, error: null });
    expect((await enDisco())[0].estado).toBe('enviado');
    expect(cola.pendientes()).toBe(0);
  });

  it('sin señal: el reporte queda guardado en IndexedDB como pendiente y no se envía', async () => {
    ponerEnLinea(e, false);
    await cola.registrar(nuevo());
    await cola.inactivo();
    expect(api.totalRecibidos).toBe(0);
    expect(cola.pendientes()).toBe(1);
    const disco = await enDisco();
    expect(disco).toHaveLength(1);
    expect(disco[0]).toMatchObject({ estado: 'pendiente', operadorId: 'ej-op-8112345678' });
  });

  it('al recuperar la conexión se envían solos, en orden', async () => {
    ponerEnLinea(e, false);
    const a = await cola.registrar(nuevo('EnPosicionamiento'));
    e.reloj.ahora = new Date('2026-11-23T16:05:00Z');
    const b = await cola.registrar(nuevo('EnPatioOrigen'));
    await cola.inactivo();
    expect(cola.pendientes()).toBe(2);
    const envios: string[] = [];
    const original = api.enviarReporte.bind(api);
    vi.spyOn(api, 'enviarReporte').mockImplementation((r) => (envios.push(r.id), original(r)));
    ponerEnLinea(e, true);
    await vi.waitFor(() => expect(cola.pendientes()).toBe(0));
    expect(envios).toEqual([a.id, b.id]);
    expect(api.totalRecibidos).toBe(2);
  });

  it('sobrevive a cerrar la app: al volver a abrir lee la cola de IndexedDB y envía lo pendiente', async () => {
    ponerEnLinea(e, false);
    await cola.registrar(nuevo());
    const anterior = e;
    TestBed.resetTestingModule();
    anterior.navegador.onLine = true;
    await iniciar({ idb: anterior.idb, almacenLocal: anterior.almacenLocal, navegador: anterior.navegador });
    await vi.waitFor(() => expect(api.totalRecibidos).toBe(1));
    await vi.waitFor(() => expect(cola.reportes()[0]?.estado).toBe('enviado'));
  });

  it('reenviar el mismo id no duplica (p. ej. la app se cerró antes de guardar el acuse)', async () => {
    const r = await cola.registrar(nuevo());
    await cola.inactivo();
    expect(api.totalRecibidos).toBe(1);
    // Simula que el acuse no alcanzó a guardarse: en disco sigue pendiente.
    const almacen = new AlmacenReportesIndexedDb(e.idb);
    await almacen.guardar({ ...(await almacen.todos())[0], estado: 'pendiente' });
    await cola.procesar();
    expect(api.totalRecibidos).toBe(1);
    expect(cola.reportes().find((x) => x.id === r.id)?.estado).toBe('enviado');
  });

  it('falla del servidor: sigue pendiente con el error y agenda un reintento', async () => {
    vi.spyOn(api, 'enviarReporte').mockRejectedValueOnce(new ErrorApiOperador('servidor', 'El servidor no respondió.'));
    await cola.registrar(nuevo());
    await cola.inactivo();
    expect(cola.reportes()[0]).toMatchObject({ estado: 'pendiente', intentos: 1, error: 'El servidor no respondió.' });
    expect(cola.proximoReintento()).toBe('2026-11-23T16:00:05Z');
    await cola.procesar();
    expect(cola.reportes()[0].estado).toBe('enviado');
    expect(cola.proximoReintento()).toBeNull();
  });

  it('un reporte rechazado no se reintenta ni detiene a los demás', async () => {
    ponerEnLinea(e, false);
    const malo = await cola.registrar(nuevo('EnTransitoVacio')); // no aplica a un viaje cargado
    const bueno = await cola.registrar(nuevo('EnPosicionamiento'));
    ponerEnLinea(e, true);
    await vi.waitFor(() => expect(cola.pendientes()).toBe(0));
    const porId = Object.fromEntries(cola.reportes().map((r) => [r.id, r]));
    expect(porId[malo.id]).toMatchObject({ estado: 'rechazado', error: 'Ese estatus no lo puede poner el operador en este viaje.' });
    expect(porId[bueno.id].estado).toBe('enviado');
  });

  it('sesión vencida al enviar: cierra la sesión con aviso; el reporte se queda pendiente para después', async () => {
    vi.spyOn(api, 'enviarReporte').mockRejectedValueOnce(new ErrorApiOperador('sesion', 'Vencida'));
    await cola.registrar(nuevo());
    await cola.inactivo();
    const sesion = TestBed.inject(AlmacenSesion);
    expect(sesion.sesion()).toBeNull();
    expect(sesion.aviso()).toBe(MENSAJE_SESION_VENCIDA);
    expect((await enDisco())[0].estado).toBe('pendiente');
  });

  it('en un teléfono compartido cada operador ve y envía solo lo suyo', async () => {
    ponerEnLinea(e, false);
    await cola.registrar(nuevo());
    await cola.inactivo();
    e.navegador.onLine = true; // vuelve la señal (sin evento: la cola no se entera todavía)
    await entrarComo('8119999999');
    expect(cola.reportes()).toEqual([]);
    expect(cola.pendientes()).toBe(0);
    await cola.procesar();
    expect(api.totalRecibidos).toBe(0);
    await entrarComo('8112345678');
    expect(cola.pendientes()).toBe(1);
  });

  it('sin sesión no se puede registrar', async () => {
    TestBed.inject(AlmacenSesion).limpiar();
    await expect(cola.registrar(nuevo())).rejects.toThrow('No hay sesión');
  });

  it('hito: queda "Pendiente de confirmar por oficina" y al actualizar estados pasa a "Confirmado"', async () => {
    await cola.registrar(nuevo('Documentado'));
    await cola.inactivo();
    expect(cola.reportes()[0].estado).toBe('por-confirmar');
    const antes = cola.enviados();
    await cola.actualizarEstados();
    expect(cola.reportes()[0].estado).toBe('por-confirmar');
    expect(cola.enviados()).toBe(antes);
    e.reloj.ahora = new Date('2026-11-23T16:00:30Z');
    await cola.actualizarEstados();
    expect(cola.reportes()[0]).toMatchObject({ estado: 'confirmado', confirmadoEn: '2026-11-23T16:00:20Z' });
    expect((await enDisco())[0].estado).toBe('confirmado');
    expect(cola.enviados()).toBe(antes + 1); // avisa a las pantallas para releer el viaje
  });

  it('incidencia: se guarda y se envía igual que un estatus; queda "Enviado"', async () => {
    const r = await cola.registrar({
      tipo: 'incidencia',
      viajeId: 'ej-via-771',
      incidencia: 'DetenidoParador',
      ocurrioEn: '2026-11-23T16:00:00Z',
      ubicacion: null,
      nota: null,
      resumen: 'Viaje 2',
    });
    await cola.inactivo();
    expect(r.reporte).toMatchObject({ tipo: 'incidencia', incidencia: 'DetenidoParador' });
    expect(cola.reportes()[0].estado).toBe('enviado');
  });

  it('paso que la oficina ya rebasó: "Enviado" con aviso (sin efecto)', async () => {
    await cola.registrar(nuevo('EnCarga'));
    await cola.inactivo();
    e.reloj.ahora = new Date('2026-11-23T16:00:30Z'); // la oficina pone Documentado por su cuenta
    ponerEnLinea(e, false);
    await cola.registrar(nuevo('EnPatioOrigen'));
    ponerEnLinea(e, true);
    await vi.waitFor(() => expect(cola.pendientes()).toBe(0));
    const atrasado = cola.reportes().find((r) => r.reporte.tipo === 'estatus' && r.reporte.estatus === 'EnPatioOrigen')!;
    expect(atrasado).toMatchObject({ estado: 'enviado', aviso: expect.stringContaining('«Documentado»') });
  });
});
