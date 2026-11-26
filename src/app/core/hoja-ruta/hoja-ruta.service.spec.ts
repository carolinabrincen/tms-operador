import { TestBed } from '@angular/core/testing';
import { ErrorApiOperador, OPERADOR_API } from '../api/operador-api';
import { OperadorApiEjemplo } from '../api/ejemplo/operador-api-ejemplo';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../sesion/almacen-sesion';
import { EntornoPruebas, configurar, crearEntorno, entrarComo, ponerEnLinea } from '../../testing/entorno-pruebas';
import { HojaRutaService, claveCopiaHojaRuta } from './hoja-ruta.service';

const OPERADOR = 'ej-op-8112345678';

describe('HojaRutaService: hoja de ruta guardada en el teléfono para verla sin señal', () => {
  let e: EntornoPruebas;
  let s: HojaRutaService;

  beforeEach(async () => {
    e = crearEntorno();
    configurar(e);
    await entrarComo();
    s = TestBed.inject(HojaRutaService);
  });

  it('carga la hoja y guarda una copia en el teléfono', async () => {
    await s.cargar();
    expect(s.estado()).toBe('listo');
    expect(s.hojaRuta()!.folio).toBe('SAL-2026-00418');
    expect(s.desdeCopia()).toBe(false);
    expect(s.error()).toBeNull();
    const copia = JSON.parse(e.almacenLocal.getItem(claveCopiaHojaRuta(OPERADOR))!);
    expect(copia.hojaRuta.itinerario).toHaveLength(4);
  });

  it('sin señal con copia: muestra la guardada y avisa que puede no estar al día', async () => {
    await s.cargar();
    s.olvidar(null); // reinicia la memoria, conserva la copia
    e.navegador.onLine = false;
    await s.cargar();
    expect(s.estado()).toBe('listo');
    expect(s.desdeCopia()).toBe(true);
    expect(s.hojaRuta()!.folio).toBe('SAL-2026-00418');
    expect(s.error()).toBe(
      'Sin conexión con la oficina: se muestra la hoja guardada (23 nov, 10:00\u00a0a.\u00a0m.); puede no estar al día (la oficina pudo cambiar paradas o casetas).',
    );
  });

  it('sin señal y sin copia: error claro', async () => {
    e.navegador.onLine = false;
    await s.cargar();
    expect(s.estado()).toBe('error');
    expect(s.error()).toBe('No se pudo cargar la hoja de ruta. Revise su señal e intente de nuevo.');
  });

  it('al recuperar la señal se vuelve a pedir (la oficina pudo cambiar paradas o casetas)', async () => {
    await s.cargar();
    const pedir = vi.spyOn(TestBed.inject(OPERADOR_API), 'obtenerHojaRuta');
    ponerEnLinea(e, false);
    ponerEnLinea(e, true);
    await vi.waitFor(() => expect(pedir).toHaveBeenCalledOnce());
  });

  it('sin salida activa: hoja null, sin error (la pantalla lo dice)', async () => {
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    await api.obtenerAsignacion(); // crea la salida del operador en el ejemplo
    api.cerrarSalida(OPERADOR);
    await s.cargar();
    expect(s.estado()).toBe('listo');
    expect(s.hojaRuta()).toBeNull();
    expect(s.error()).toBeNull();
  });

  it('sesión vencida: cierra la sesión con aviso', async () => {
    vi.spyOn(TestBed.inject(OPERADOR_API), 'obtenerHojaRuta').mockRejectedValueOnce(new ErrorApiOperador('sesion', 'x'));
    await s.cargar();
    expect(TestBed.inject(AlmacenSesion).aviso()).toBe(MENSAJE_SESION_VENCIDA);
  });

  it('olvidar (al salir) borra la copia', async () => {
    await s.cargar();
    s.olvidar(OPERADOR);
    expect(e.almacenLocal.getItem(claveCopiaHojaRuta(OPERADOR))).toBeNull();
    expect(s.hojaRuta()).toBeNull();
    expect(s.estado()).toBe('inicial');
  });
});
