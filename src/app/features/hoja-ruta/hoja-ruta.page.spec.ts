import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { EntornoPruebas, configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { HojaRutaPage } from './hoja-ruta.page';

async function montar(e: EntornoPruebas = crearEntorno()) {
  configurar(e);
  await entrarComo();
  await TestBed.inject(HojaRutaService).cargar();
  const f = TestBed.createComponent(HojaRutaPage);
  await f.whenStable();
  return { f, el: f.nativeElement as HTMLElement, e };
}

describe('HojaRutaPage: la hoja de ruta en el teléfono', () => {
  it('empresa y teléfonos que llaman al tocarlos; "Generada el" en hora del negocio', async () => {
    const { el } = await montar();
    expect(el.querySelector('#titulo-empresa')!.textContent).toBe('Transportes de Ejemplo del Norte');
    const tels = [...el.querySelectorAll<HTMLAnchorElement>('.telefonos a')].map((a) => [a.getAttribute('href'), a.textContent!.trim()]);
    expect(tels).toEqual([
      ['tel:8005550199', 'Llamar a tráfico (24 h): 800 555 0199'],
      ['tel:8155500100', 'Llamar a la oficina: 81 5550 0100'],
    ]);
    expect(el.querySelector('.generada')!.textContent).toContain('Generada el 23/11/2026 08:00 (hora del centro de México)');
  });

  it('unidad y remolques; cada tramo en orden con origen, destino y dirección, citas y producto', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('T-104 · Placas 41-AK-7R');
    expect(el.querySelector('.remolque dd')!.textContent).toBe('R-221 · Placas 12-UP-3X');
    const tramos = [...el.querySelectorAll('.tramo h3')].map((h) => h.textContent!.trim());
    expect(tramos).toEqual(['Tramo 1 · Vacío', 'Tramo 2 · Cargado · VIA-2026-00771', 'Tramo 3 · Cargado · VIA-2026-00772', 'Tramo 4 · Vacío']);
    const t2 = el.querySelectorAll('.tramo')[1];
    expect(t2.querySelector('.cliente')!.textContent).toBe('Aceros del Norte (ejemplo)');
    expect(t2.querySelector('.origen')!.textContent).toContain('Planta · Av. Ejemplo 100, Parque Industrial, C.P. 66600');
    expect(t2.textContent).toContain('Cita de carga');
    expect(t2.textContent).toContain('23/11/2026 08:00');
    expect(t2.textContent).toContain('28.5 t');
    expect(t2.textContent).toContain('OC-55821');
  });

  it('MATERIAL PELIGROSO solo donde aplica; motivo del vacío traducido; paradas y casetas por nombre', async () => {
    const { el } = await montar();
    const tramos = [...el.querySelectorAll('.tramo')];
    expect(tramos.map((t) => !!t.querySelector('.marca-peligro'))).toEqual([false, false, true, false]);
    expect(tramos[2].querySelector('.marca-peligro')!.textContent).toBe('MATERIAL PELIGROSO');
    expect(tramos[0].textContent).toContain('Carga de combustible');
    expect(tramos[3].textContent).toContain('Taller · Servicio de frenos');
    expect([...tramos[2].querySelectorAll('.paradas li strong')].map((s) => s.textContent)).toEqual(['Carga de diésel', 'Resguardo']);
    expect([...tramos[2].querySelectorAll('.casetas li')].map((l) => l.textContent!.trim())).toEqual([
      'Plaza Los Chorros (ejemplo) (Saltillo - Matehuala)',
      'Plaza Huizache (ejemplo) (Matehuala - San Luis Potosí)',
    ]);
  });

  it('"Abrir en mapa" por tramo con ruta, con la liga https del servidor, en otra pestaña', async () => {
    const { el } = await montar();
    const mapas = [...el.querySelectorAll<HTMLAnchorElement>('.abrir-mapa')];
    expect(mapas).toHaveLength(2);
    expect(mapas[0].href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    expect(mapas[0].target).toBe('_blank');
    expect(mapas[0].rel).toContain('noopener');
  });

  it('nunca muestra dinero', async () => {
    const { el } = await montar();
    expect(el.textContent).not.toMatch(/\$|pesos|tarifa|importe|flete|costo|pago/i);
  });

  it('sin señal: muestra la guardada y avisa que puede no estar al día', async () => {
    const e = crearEntorno();
    configurar(e);
    await entrarComo();
    const s = TestBed.inject(HojaRutaService);
    await s.cargar();
    s.olvidar(null);
    e.navegador.onLine = false;
    await s.cargar();
    const f = TestBed.createComponent(HojaRutaPage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.alerta-aviso')!.textContent).toContain('puede no estar al día');
    expect(el.querySelectorAll('.tramo')).toHaveLength(4);
  });

  it('sin salida activa: mensaje claro, sin pantalla vacía', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    await api.obtenerAsignacion();
    api.cerrarSalida('ej-op-8112345678');
    await TestBed.inject(HojaRutaService).cargar();
    const f = TestBed.createComponent(HojaRutaPage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.sin-hoja h2')!.textContent).toBe('No tiene una salida activa');
    expect(el.querySelector('.sin-hoja')!.textContent).toContain('Por eso no hay hoja de ruta.');
    expect(el.querySelector('.tramo')).toBeNull();
  });
});
