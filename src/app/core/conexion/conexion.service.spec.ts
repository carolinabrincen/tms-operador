import { TestBed } from '@angular/core/testing';
import { configurar, crearEntorno, ponerEnLinea } from '../../testing/entorno-pruebas';
import { ConexionService } from './conexion.service';

describe('ConexionService: indicador de conexión y aviso al recuperarla', () => {
  it('arranca con lo que dice el navegador y sigue los eventos online/offline', () => {
    const e = crearEntorno({ navegador: { onLine: false } });
    configurar(e);
    const c = TestBed.inject(ConexionService);
    expect(c.enLinea()).toBe(false);
    ponerEnLinea(e, true);
    expect(c.enLinea()).toBe(true);
    ponerEnLinea(e, false);
    expect(c.enLinea()).toBe(false);
  });

  it('avisa al recuperar la conexión y al volver a la app con conexión; se puede dar de baja', () => {
    const e = crearEntorno();
    configurar(e);
    const c = TestBed.inject(ConexionService);
    const accion = vi.fn();
    const baja = c.alRecuperar(accion);
    ponerEnLinea(e, false);
    expect(accion).not.toHaveBeenCalled();
    ponerEnLinea(e, true);
    expect(accion).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(accion).toHaveBeenCalledTimes(2);
    baja();
    ponerEnLinea(e, true);
    expect(accion).toHaveBeenCalledTimes(2);
  });

  it('al destruirse deja de escuchar', () => {
    const e = crearEntorno();
    configurar(e);
    const c = TestBed.inject(ConexionService);
    TestBed.resetTestingModule();
    ponerEnLinea(e, false);
    expect(c.enLinea()).toBe(true);
  });
});
