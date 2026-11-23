import { TestBed } from '@angular/core/testing';
import { ErrorApiOperador, OPERADOR_API } from '../api/operador-api';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';
import { EntornoPruebas, configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { AsignacionService, claveCopiaAsignacion } from './asignacion.service';

describe('AsignacionService: despacho del operador, también sin señal', () => {
  let e: EntornoPruebas;
  let servicio: AsignacionService;
  const CLAVE = claveCopiaAsignacion('ej-op-8112345678');

  beforeEach(async () => {
    e = crearEntorno();
    configurar(e);
    await entrarComo();
    servicio = TestBed.inject(AsignacionService);
  });

  it('carga el despacho y guarda una copia en el teléfono', async () => {
    await servicio.cargar();
    expect(servicio.estado()).toBe('listo');
    expect(servicio.asignacion()?.despacho?.folio).toBe('DES-2026-00418');
    expect(servicio.desdeCopia()).toBe(false);
    expect(servicio.actualizadaEn()).toBe('2026-11-23T16:00:00Z');
    expect(JSON.parse(e.almacenLocal.getItem(CLAVE)!).guardadaEn).toBe('2026-11-23T16:00:00Z');
  });

  it('sin señal y con copia: muestra lo guardado y lo dice, con fecha y hora del negocio', async () => {
    await servicio.cargar();
    servicio.olvidar(null); // reinicia la memoria, conserva la copia
    e.navegador.onLine = false;
    await servicio.cargar();
    expect(servicio.estado()).toBe('listo');
    expect(servicio.desdeCopia()).toBe(true);
    expect(servicio.asignacion()?.despacho?.folio).toBe('DES-2026-00418');
    expect(servicio.error()).toBe('Sin conexión con la oficina. Se muestra lo guardado el 23/11/2026 10:00.');
  });

  it('sin señal y sin copia: error claro', async () => {
    e.navegador.onLine = false;
    await servicio.cargar();
    expect(servicio.estado()).toBe('error');
    expect(servicio.asignacion()).toBeNull();
    expect(servicio.error()).toBe('No se pudo cargar su despacho. Revise su señal e intente de nuevo.');
  });

  it('sin despacho activo: despacho null (la pantalla lo dice)', async () => {
    await entrarComo('8112340000');
    await servicio.cargar();
    expect(servicio.asignacion()).toEqual({ despacho: null, movimientosVacio: [] });
  });

  it('sesión vencida: cierra la sesión con aviso', async () => {
    vi.spyOn(TestBed.inject(OPERADOR_API), 'obtenerAsignacion').mockRejectedValueOnce(new ErrorApiOperador('sesion', 'x'));
    await servicio.cargar();
    expect(TestBed.inject(AlmacenSesion).sesion()).toBeNull();
    expect(TestBed.inject(AlmacenSesion).aviso()).toBe(MENSAJE_SESION_VENCIDA);
  });

  it('olvidar (al salir) borra la copia del teléfono', async () => {
    await servicio.cargar();
    servicio.olvidar('ej-op-8112345678');
    expect(e.almacenLocal.getItem(CLAVE)).toBeNull();
    expect(servicio.asignacion()).toBeNull();
    expect(servicio.estado()).toBe('inicial');
  });

  it('asegurar: carga una sola vez por operador', async () => {
    const spy = vi.spyOn(TestBed.inject(OPERADOR_API), 'obtenerAsignacion');
    await servicio.asegurar();
    await servicio.asegurar();
    expect(spy).toHaveBeenCalledTimes(1);
    await entrarComo('8110000001');
    await servicio.asegurar();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
