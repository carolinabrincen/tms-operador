import { TestBed } from '@angular/core/testing';
import { NavegadorMinimo } from '../plataforma';
import { EntornoPruebas, configurar, crearEntorno } from '../../testing/entorno-pruebas';
import { CLAVE_UBICACION_EXPLICADA, UbicacionService } from './ubicacion.service';

type Exito = (p: GeolocationPosition) => void;
type Falla = (e: GeolocationPositionError) => void;

function con(navegador: Partial<NavegadorMinimo>): { e: EntornoPruebas; u: UbicacionService } {
  const e = crearEntorno({ navegador: { onLine: true, ...navegador } });
  configurar(e);
  return { e, u: TestBed.inject(UbicacionService) };
}

const permiso = (state: PermissionState) => ({ query: async () => ({ state }) as PermissionStatus });

describe('UbicacionService: ubicación solo al reportar, nunca bloquea', () => {
  it('sin GPS en el teléfono: no disponible y punto null', async () => {
    const { u } = con({});
    expect(await u.estadoPermiso()).toBe('no-disponible');
    expect(await u.necesitaExplicacion()).toBe(false);
    expect(await u.obtenerPunto()).toBeNull();
  });

  it('explica antes de pedir el permiso cuando el navegador va a preguntar', async () => {
    const geolocation = { getCurrentPosition: vi.fn() };
    expect(await con({ geolocation, permissions: permiso('prompt') }).u.necesitaExplicacion()).toBe(true);
    TestBed.resetTestingModule();
    expect(await con({ geolocation, permissions: permiso('granted') }).u.necesitaExplicacion()).toBe(false);
    TestBed.resetTestingModule();
    expect(await con({ geolocation, permissions: permiso('denied') }).u.estadoPermiso()).toBe('negado');
  });

  it('sin Permissions API (iPhone): explica solo la primera vez', async () => {
    const { e, u } = con({ geolocation: { getCurrentPosition: vi.fn() } });
    expect(await u.necesitaExplicacion()).toBe(true);
    u.marcarExplicada();
    expect(e.almacenLocal.getItem(CLAVE_UBICACION_EXPLICADA)).toBe('1');
    expect(await u.necesitaExplicacion()).toBe(false);
  });

  it('con permiso: devuelve el punto', async () => {
    const geolocation = {
      getCurrentPosition: (ok: Exito) => ok({ coords: { latitude: 25.6866, longitude: -100.3161, accuracy: 8 }, timestamp: Date.UTC(2026, 10, 23, 16) } as GeolocationPosition),
    };
    const { u } = con({ geolocation: geolocation as never });
    expect(await u.obtenerPunto()).toEqual({ lat: 25.6866, lng: -100.3161, precisionM: 8, tomadoEn: '2026-11-23T16:00:00Z' });
  });

  it('negado, error de GPS o excepción: null, sin lanzar', async () => {
    const falla = { getCurrentPosition: (_: Exito, mal: Falla) => mal({ code: 1 } as GeolocationPositionError) };
    expect(await con({ geolocation: falla as never }).u.obtenerPunto()).toBeNull();
    TestBed.resetTestingModule();
    const lanza = { getCurrentPosition: () => { throw new Error('x'); } };
    expect(await con({ geolocation: lanza as never }).u.obtenerPunto()).toBeNull();
  });

  it('si el GPS nunca contesta (o el operador ignora la pregunta), se rinde al tope y devuelve null', async () => {
    const mudo = { getCurrentPosition: vi.fn() };
    const { u } = con({ geolocation: mudo });
    const inicio = Date.now();
    expect(await u.obtenerPunto(30)).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(mudo.getCurrentPosition).toHaveBeenCalledOnce();
  });
});
