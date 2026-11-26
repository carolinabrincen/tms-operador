import { TestBed } from '@angular/core/testing';
import { hojaRutaEjemplo, salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { PlazaCobroHoja } from '../../core/api/operador-api-m2.modelos';
import { CasetasService, claveCasetas } from '../../core/hoja-ruta/casetas.service';
import { configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { estadoCasetas, textoRenglonHoja, tramoDeViaje } from './casetas.util';

const AHORA = new Date('2026-11-23T16:00:00Z');
const plazas: PlazaCobroHoja[] = [
  { orden: 2, nombre: 'Esperanza', autopista: null },
  { orden: 1, nombre: 'Fortín', autopista: 'Córdoba - Puebla' },
  { orden: 3, nombre: 'Amozoc', autopista: null },
];

describe('casetas.util: SOLO la próxima caseta', () => {
  it('"Próxima caseta · n de N" en el orden en que se cruzan; al pasar todas, ninguna pendiente', () => {
    expect(estadoCasetas(plazas, 0)).toMatchObject({ total: 3, pasadas: 0, n: 1, proxima: { nombre: 'Fortín' } });
    expect(estadoCasetas(plazas, 1)).toMatchObject({ n: 2, proxima: { nombre: 'Esperanza' } });
    expect(estadoCasetas(plazas, 3)).toMatchObject({ pasadas: 3, n: 3, proxima: null });
    expect(estadoCasetas(plazas, 0)!.lista.map((c) => c.nombre)).toEqual(['Fortín', 'Esperanza', 'Amozoc']);
    // Valores fuera de rango (copia vieja o la oficina quitó casetas): se acotan.
    expect(estadoCasetas(plazas, 9)!.pasadas).toBe(3);
    expect(estadoCasetas(plazas, -2)!.pasadas).toBe(0);
    // Sin casetas: no hay nada que mostrar.
    expect(estadoCasetas([], 0)).toBeNull();
    expect(estadoCasetas(null, 0)).toBeNull();
  });

  it('renglón de Mi viaje', () => {
    expect(textoRenglonHoja(estadoCasetas(plazas, 0))).toBe('Hoja de ruta · próxima caseta: Fortín');
    expect(textoRenglonHoja(estadoCasetas(plazas, 3))).toBe('Hoja de ruta · sin casetas pendientes');
    expect(textoRenglonHoja(null)).toBe('Hoja de ruta');
  });

  it('el tramo de un viaje: por folio, o por orden si el tramo no trae folio (vacíos)', () => {
    const hoja = hojaRutaEjemplo(AHORA);
    const [vacio, cargado] = salidaEjemplo(AHORA).viajes;
    expect(tramoDeViaje(hoja, cargado)!.orden).toBe(2);
    expect(tramoDeViaje(hoja, vacio)!.orden).toBe(1);
    expect(tramoDeViaje(null, cargado)).toBeNull();
  });
});

describe('CasetasService: "Ya la pasé" se recuerda en el teléfono por salida', () => {
  it('avanza, regresa, no pasa del total y empieza de cero en otra salida', async () => {
    const e = crearEntorno();
    configurar(e);
    await entrarComo();
    const s = TestBed.inject(CasetasService);
    expect(s.pasadas('SAL-1', 3)).toBe(0);
    s.pasar('SAL-1', 3, 2);
    s.pasar('SAL-1', 3, 2);
    s.pasar('SAL-1', 3, 2);
    expect(s.pasadas('SAL-1', 3)).toBe(2);
    s.regresar('SAL-1', 3);
    expect(s.pasadas('SAL-1', 3)).toBe(1);
    expect(s.pasadas('SAL-1', 2)).toBe(0);
    // Guardado en el teléfono: otra instancia lo lee igual. Solo conteos, nunca importes.
    const guardado = e.almacenLocal.getItem(claveCasetas('ej-op-8112345678'))!;
    expect(JSON.parse(guardado)).toEqual({ folio: 'SAL-1', pasadas: { '3': 1 } });
    // Otra salida: de cero, y la anterior se descarta.
    expect(s.pasadas('SAL-2', 3)).toBe(0);
    s.pasar('SAL-2', 1, 4);
    expect(JSON.parse(e.almacenLocal.getItem(claveCasetas('ej-op-8112345678'))!)).toEqual({ folio: 'SAL-2', pasadas: { '1': 1 } });
  });
});
