import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../api/ejemplo/operador-api-ejemplo';
import { CODIGOS_EVIDENCIA, ErrorApiOperador, OPERADOR_API } from '../api/operador-api';
import { TipoEvidencia } from '../api/operador-api-m2.modelos';
import { ColaReportesService } from '../reportes/cola-reportes.service';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';
import { AsignacionService } from '../viaje/asignacion.service';
import { FORMATO_UUID_V4 } from '../../shared/utils/id-reporte.util';
import { EntornoPruebas, configurar, crearEntorno, entrarComo, fotoJpeg, ponerEnLinea } from '../../testing/entorno-pruebas';
import { AlmacenEvidenciasIndexedDb } from './almacen-evidencias';
import { ColaEvidenciasService, NuevaEvidencia } from './cola-evidencias.service';

const CARGADO = 'ej-via-771';
const OPERADOR = 'ej-op-8112345678';

function nueva(n = 1, tipo: TipoEvidencia = 'Sellos', extra: Partial<NuevaEvidencia['datos']> = {}): NuevaEvidencia {
  return {
    datos: { viajeId: CARGADO, tipo, descripcion: null, nota: '  Sellos completos  ', reporteId: null, tomadaEn: '2026-11-23T16:00:00Z', ubicacion: null, ...extra },
    foto: fotoJpeg(n),
    resumen: 'Viaje 2',
  };
}

describe('ColaEvidenciasService: fotos guardadas primero, subidas después, sin duplicar', () => {
  let e: EntornoPruebas;
  let cola: ColaEvidenciasService;
  let api: OperadorApiEjemplo;

  async function iniciar(previo?: Partial<EntornoPruebas>) {
    e = crearEntorno(previo);
    configurar(e);
    api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    await entrarComo();
    await TestBed.inject(AsignacionService).cargar();
    cola = TestBed.inject(ColaEvidenciasService);
    await cola.listo();
  }
  const enDisco = () => new AlmacenEvidenciasIndexedDb(e.idb).todas();

  beforeEach(async () => iniciar());

  it('con señal: guarda la foto en el teléfono, la sube y queda "Enviada" con el acuse; id UUID del teléfono; nota recortada', async () => {
    const f = await cola.registrar(nueva());
    expect(f.id).toMatch(FORMATO_UUID_V4);
    expect(f.datos).toMatchObject({ id: f.id, nota: 'Sellos completos', viajeId: CARGADO });
    await cola.inactivo();
    expect(cola.fotos()[0]).toMatchObject({ id: f.id, estado: 'enviada', mensaje: 'Recibida: Sellos.', intentos: 1 });
    expect((await api.evidenciasDeViaje(CARGADO)).map((x) => x.id)).toContain(f.id);
  });

  it('sin señal: queda en IndexedDB como Pendiente (con la foto) y se sube sola al volver la señal', async () => {
    ponerEnLinea(e, false);
    const f = await cola.registrar(nueva());
    await cola.inactivo();
    expect(cola.pendientes()).toBe(1);
    const disco = await enDisco();
    expect(disco[0]).toMatchObject({ id: f.id, estado: 'pendiente', operadorId: OPERADOR });
    expect(disco[0].foto!.byteLength).toBe(64);
    ponerEnLinea(e, true);
    await vi.waitFor(() => expect(cola.pendientes()).toBe(0));
    expect(cola.fotos()[0].estado).toBe('enviada');
  });

  it('sobrevive a cerrar la app: al volver a abrir lee la cola y sube lo pendiente', async () => {
    ponerEnLinea(e, false);
    await cola.registrar(nueva());
    await cola.inactivo();
    const idb = e.idb;
    TestBed.resetTestingModule();
    await iniciar({ idb });
    await vi.waitFor(() => expect(cola.fotos()[0]?.estado).toBe('enviada'));
  });

  it('reenviar el mismo id con la misma foto NO duplica (la respuesta se perdió): el servidor devuelve el mismo acuse', async () => {
    const subir = vi.spyOn(api, 'subirEvidencia');
    // La primera vez la foto llega al servidor, pero la respuesta "se pierde".
    subir.mockImplementationOnce(async (foto, datos) => {
      await OperadorApiEjemplo.prototype.subirEvidencia.call(api, foto, datos);
      throw new ErrorApiOperador('sin-conexion', 'Sin conexión.');
    });
    const f = await cola.registrar(nueva());
    await cola.inactivo();
    expect(cola.fotos()[0].estado).toBe('pendiente');
    await cola.procesar();
    expect(subir).toHaveBeenCalledTimes(2);
    expect(subir.mock.calls[1][1].id).toBe(f.id); // mismo id
    expect(cola.fotos()[0].estado).toBe('enviada');
    expect((await api.evidenciasDeViaje(CARGADO)).filter((x) => x.autor === 'operador')).toHaveLength(1);
  });

  it('falla del servidor: sigue Pendiente con el error y agenda un reintento', async () => {
    vi.spyOn(api, 'subirEvidencia').mockRejectedValueOnce(new ErrorApiOperador('servidor', 'La oficina no responde en este momento.', null, 500));
    await cola.registrar(nueva());
    await cola.inactivo();
    expect(cola.fotos()[0]).toMatchObject({ estado: 'pendiente', error: 'La oficina no responde en este momento.' });
    expect(cola.proximoReintento()).not.toBeNull();
  });

  it('reintento: al cumplirse la espera vuelve a subir sola', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      vi.spyOn(api, 'subirEvidencia').mockRejectedValueOnce(new ErrorApiOperador('limite', 'Demasiadas peticiones.', null, 429));
      await cola.registrar(nueva());
      await cola.inactivo();
      expect(cola.fotos()[0].estado).toBe('pendiente');
      await vi.advanceTimersByTimeAsync(5000);
      vi.useRealTimers();
      await vi.waitFor(() => expect(cola.fotos()[0].estado).toBe('enviada'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('No aceptada con un texto de usted por código, y no detiene a las demás', async () => {
    vi.spyOn(api, 'subirEvidencia').mockRejectedValueOnce(
      new ErrorApiOperador('rechazado', 'Salida cerrada.', CODIGOS_EVIDENCIA.salidaCerrada, 409),
    );
    const a = await cola.registrar(nueva(1));
    const b = await cola.registrar(nueva(2));
    await vi.waitFor(() => expect(cola.pendientes()).toBe(0));
    const porId = Object.fromEntries(cola.fotos().map((f) => [f.id, f]));
    expect(porId[a.id]).toMatchObject({ estado: 'rechazada', error: 'La salida se cerró hace más de 72 horas: ya no se suben fotos desde la app. La oficina puede subirla.' });
    expect(porId[a.id].foto).not.toBeNull(); // se conserva para mostrársela a la oficina
    expect(porId[b.id].estado).toBe('enviada');
  });

  it('409 VIAJE_EVIDENCIA_CLAVE_DUPLICADA: la misma foto con otro id, y se reenvía sola', async () => {
    vi.spyOn(api, 'subirEvidencia').mockRejectedValueOnce(new ErrorApiOperador('id-duplicado', 'x', CODIGOS_EVIDENCIA.claveDuplicada, 409));
    const f = await cola.registrar(nueva());
    await vi.waitFor(() => expect(cola.fotos()[0]?.estado).toBe('enviada'));
    expect(cola.fotos()).toHaveLength(1);
    expect(cola.fotos()[0].id).not.toBe(f.id);
    expect((await enDisco()).map((x) => x.id)).toEqual([cola.fotos()[0].id]);
  });

  it('sesión vencida al subir: cierra la sesión con aviso; la foto se queda pendiente', async () => {
    vi.spyOn(api, 'subirEvidencia').mockRejectedValueOnce(new ErrorApiOperador('sesion', 'x', null, 401));
    await cola.registrar(nueva());
    await cola.inactivo();
    expect(TestBed.inject(AlmacenSesion).aviso()).toBe(MENSAJE_SESION_VENCIDA);
    expect((await enDisco())[0].estado).toBe('pendiente');
  });

  it('estados: Recibida (se borra la foto del teléfono) y Anulada por la oficina con su motivo', async () => {
    const a = await cola.registrar(nueva(1));
    const b = await cola.registrar(nueva(2));
    await vi.waitFor(() => expect(cola.fotos().every((f) => f.estado === 'enviada')).toBe(true));
    api.anularEvidencia(b.id, 'foto borrosa');
    await cola.actualizarEstados();
    const porId = Object.fromEntries(cola.fotos().map((f) => [f.id, f]));
    expect(porId[a.id]).toMatchObject({ estado: 'recibida', foto: null });
    expect(porId[b.id]).toMatchObject({ estado: 'anulada', mensaje: 'La oficina anuló la evidencia: foto borrosa', foto: null });
    // Una recibida de la salida activa se sigue consultando: la oficina puede anularla después.
    api.anularEvidencia(a.id, 'duplicada');
    await cola.actualizarEstados();
    expect(cola.fotos().find((f) => f.id === a.id)).toMatchObject({ estado: 'anulada', mensaje: 'La oficina anuló la evidencia: duplicada' });
  });

  it('una enviada que el servidor no conoce (no llegó) se vuelve a subir con el mismo id', async () => {
    const f = await cola.registrar(nueva());
    await cola.inactivo();
    vi.spyOn(api, 'consultarEvidencias').mockResolvedValueOnce([]);
    const subir = vi.spyOn(api, 'subirEvidencia');
    await cola.actualizarEstados();
    await cola.inactivo();
    expect(subir).toHaveBeenCalledOnce();
    expect(subir.mock.calls[0][1].id).toBe(f.id);
    expect(cola.fotos()[0].estado).toBe('enviada');
  });

  it('la foto ligada a un reporte espera a que ese reporte llegue al servidor', async () => {
    const reportes = TestBed.inject(ColaReportesService);
    ponerEnLinea(e, false);
    const r = await reportes.registrar({
      tipo: 'estatus',
      viajeId: CARGADO,
      estatus: 'Descargado',
      ocurrioEn: '2026-11-23T16:00:00Z',
      ubicacion: null,
      nota: null,
      resumen: 'Viaje 2',
    });
    await cola.registrar(nueva(1, 'AcuseRecibido', { reporteId: r.id }));
    const subir = vi.spyOn(api, 'subirEvidencia');
    // Vuelve la señal, pero el reporte aún no se envía (falla una vez): la foto no se sube antes que él.
    const enviar = vi.spyOn(api, 'enviarReporte').mockRejectedValueOnce(new ErrorApiOperador('servidor', 'x', null, 500));
    ponerEnLinea(e, true);
    await vi.waitFor(() => expect(enviar).toHaveBeenCalled());
    await reportes.inactivo();
    await cola.inactivo();
    expect(subir).not.toHaveBeenCalled();
    await reportes.procesar(); // ahora sí llega el reporte…
    await vi.waitFor(() => expect(cola.fotos()[0].estado).toBe('enviada')); // …y la foto sube sola
    expect(subir.mock.calls[0][1].reporteId).toBe(r.id);
  });

  it('en un teléfono compartido cada operador ve y sube solo lo suyo', async () => {
    ponerEnLinea(e, false);
    await cola.registrar(nueva());
    await cola.inactivo();
    e.navegador.onLine = true; // con señal, pero sin el evento: no dispara la subida del operador anterior
    await entrarComo('8119999999');
    expect(cola.fotos()).toEqual([]);
    expect(cola.pendientes()).toBe(0);
    await cola.procesar(); // sube solo lo del operador con sesión (nada)
    expect((await enDisco())[0]).toMatchObject({ operadorId: OPERADOR, estado: 'pendiente' });
  });

  it('avisa cuando se acumulan 10 o más fotos sin enviar', async () => {
    ponerEnLinea(e, false);
    for (let i = 0; i < 9; i++) await cola.registrar(nueva(i));
    expect(cola.avisoAcumuladas()).toBeNull();
    await cola.registrar(nueva(10));
    expect(cola.avisoAcumuladas()).toContain('Tiene 10 fotos sin enviar');
  });

  it('sin sesión no se puede guardar', async () => {
    TestBed.inject(AlmacenSesion).limpiar();
    await expect(cola.registrar(nueva())).rejects.toThrow('No hay sesión');
  });
});
