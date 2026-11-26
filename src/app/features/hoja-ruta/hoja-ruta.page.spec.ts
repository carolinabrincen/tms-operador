import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { CasetasService } from '../../core/hoja-ruta/casetas.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { EntornoPruebas, configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { HojaRutaPage } from './hoja-ruta.page';

async function montar(e: EntornoPruebas = crearEntorno()) {
  configurar(e);
  await entrarComo();
  await TestBed.inject(HojaRutaService).cargar();
  const f = TestBed.createComponent(HojaRutaPage);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const limpio = (n: Element | null) => n?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  return { f, el, e, limpio };
}

describe('HojaRutaPage (referencia aprobada): llamar con un toque y solo la próxima caseta', () => {
  it('encabezado con regreso, unidad y "al día"; Oficina y Tráfico con "Llamar" que marca al tocarlo', async () => {
    const { el, limpio } = await montar();
    expect(el.querySelector('app-encabezado h1')!.textContent).toBe('Hoja de ruta');
    expect(limpio(el.querySelector('app-encabezado .subtitulo'))).toBe('T-104 · al día 23 nov, 10:00 a. m.');
    expect(el.querySelector('app-encabezado a.volver')!.getAttribute('href')).toBe('/viaje');
    const tels = [...el.querySelectorAll('.telefono')].map((t) => [
      limpio(t.querySelector('.etiqueta-seccion')),
      limpio(t.querySelector('.numero')),
      t.querySelector('a.llamar')!.getAttribute('href'),
      limpio(t.querySelector('a.llamar')),
    ]);
    expect(tels).toEqual([
      ['Oficina', '81 5550 0100', 'tel:8155500100', 'Llamar'],
      ['Tráfico, las 24 horas', '800 555 0199', 'tel:8005550199', 'Llamar'],
    ]);
  });

  it('cada tramo en orden con su distancia, origen y destino con una línea de detalle, y parada autorizada', async () => {
    const { el, limpio } = await montar();
    expect([...el.querySelectorAll('.tramo-titulo')].map(limpio)).toEqual(['Tramo 1 · vacío', 'Tramo 2 · cargado', 'Tramo 3 · cargado', 'Tramo 4 · vacío']);
    const t2 = el.querySelectorAll('.tramo')[1];
    expect(limpio(t2.querySelector('.distancia'))).toBe('96.5 km · 1 h 40 min');
    expect(limpio(t2.querySelector('.origen .nombre'))).toBe('Apodaca, N.L.');
    expect(limpio(t2.querySelector('.origen .detalle'))).toBe('Planta · Av. Ejemplo 100, Parque Industrial, C.P. 66600');
    expect(limpio(t2.querySelector('.destino .detalle'))).toBe('Cita: 23 nov, 1:00 p. m.');
    expect(limpio(t2.querySelector('.paradas .etiqueta-seccion'))).toBe('Parada autorizada');
    expect(limpio(t2.querySelector('.parada-nombre'))).toBe('Descanso · Parador km 40');
    // Lo demás del tramo, plegado.
    expect(t2.querySelector('details.mas-datos')!.textContent).toContain('Aceros del Norte (ejemplo)');
    expect(t2.querySelector('details.mas-datos')!.textContent).toContain('28.5 t');
  });

  it('SOLO la próxima caseta: "Próxima caseta · 1 de 2", su nombre en grande y "Ya la pasé"', async () => {
    const { el, limpio } = await montar();
    const t3 = el.querySelectorAll('.tramo')[2];
    expect(limpio(t3.querySelector('.caseta .etiqueta-seccion'))).toBe('Próxima caseta · 1 de 2');
    expect(limpio(t3.querySelector('.caseta-nombre'))).toBe('Plaza Los Chorros (ejemplo)');
    expect(t3.textContent).not.toContain('Plaza Huizache'); // la siguiente no se muestra hasta "Ver todas"
    expect(limpio(t3.querySelector('.ya-la-pase'))).toBe('Ya la pasé');
    // Sin casetas en el tramo: no hay sección de casetas.
    expect(el.querySelectorAll('.tramo')[0].querySelector('.caseta')).toBeNull();
  });

  it('"Ya la pasé" avanza a la siguiente y se recuerda en el teléfono; al terminar, "Sin casetas pendientes"', async () => {
    const { f, el, e, limpio } = await montar();
    const t3 = () => el.querySelectorAll('.tramo')[2];
    t3().querySelector<HTMLButtonElement>('.ya-la-pase')!.click();
    await f.whenStable();
    expect(limpio(t3().querySelector('.caseta .etiqueta-seccion'))).toBe('Próxima caseta · 2 de 2');
    expect(limpio(t3().querySelector('.caseta-nombre'))).toBe('Plaza Huizache (ejemplo)');
    t3().querySelector<HTMLButtonElement>('.ya-la-pase')!.click();
    await f.whenStable();
    expect(limpio(t3().querySelector('.sin-pendientes'))).toBe('Sin casetas pendientes');
    expect(t3().querySelector('.ya-la-pase')).toBeNull();
    // Otra pantalla (o la app abierta de nuevo) lo lee del teléfono.
    TestBed.resetTestingModule();
    const otra = await montar(crearEntorno({ almacenLocal: e.almacenLocal, idb: e.idb }));
    expect(limpio(otra.el.querySelectorAll('.tramo')[2].querySelector('.sin-pendientes'))).toBe('Sin casetas pendientes');
  });

  it('"Ver todas" muestra la lista completa con cuáles ya pasó; se puede regresar una marcada por error', async () => {
    const { f, el, limpio } = await montar();
    TestBed.inject(CasetasService).pasar('SAL-2026-00418', 3, 2);
    await f.whenStable();
    const t3 = el.querySelectorAll('.tramo')[2];
    const ver = t3.querySelector<HTMLButtonElement>('.ver-todas')!;
    expect(limpio(ver)).toBe('Ver todas (2)');
    expect(ver.getAttribute('aria-expanded')).toBe('false');
    ver.click();
    await f.whenStable();
    expect(ver.getAttribute('aria-expanded')).toBe('true');
    expect([...t3.querySelectorAll('.lista-casetas li')].map(limpio)).toEqual([
      'Plaza Los Chorros (ejemplo) (Saltillo - Matehuala) Pasada',
      'Plaza Huizache (ejemplo) (Matehuala - San Luis Potosí) Próxima',
    ]);
    t3.querySelector<HTMLButtonElement>('.regresar-caseta')!.click();
    await f.whenStable();
    expect(limpio(t3.querySelector('.caseta-nombre'))).toBe('Plaza Los Chorros (ejemplo)');
  });

  it('MATERIAL PELIGROSO solo donde aplica; "Abrir en mapa" por tramo con ruta, con la liga https, en otra pestaña', async () => {
    const { el } = await montar();
    const tramos = [...el.querySelectorAll('.tramo')];
    expect(tramos.map((t) => !!t.querySelector('.marca-peligro'))).toEqual([false, false, true, false]);
    const mapas = [...el.querySelectorAll<HTMLAnchorElement>('.abrir-mapa')];
    expect(mapas).toHaveLength(2);
    expect(mapas[0].href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    expect(mapas[0].target).toBe('_blank');
    expect(mapas[0].rel).toContain('noopener');
    expect(tramos[0].textContent).toContain('Carga de combustible');
  });

  it('datos de la salida y la unidad, al final', async () => {
    const { el } = await montar();
    expect(el.querySelector('#titulo-empresa')!.textContent).toBe('Transportes de Ejemplo del Norte');
    expect(el.textContent).toContain('T-104 · Placas 41-AK-7R');
    expect(el.querySelector('.remolque dd')!.textContent).toBe('R-221 · Placas 12-UP-3X');
  });

  it('nunca muestra dinero (ni con la lista de casetas abierta)', async () => {
    const { f, el } = await montar();
    for (const b of el.querySelectorAll<HTMLButtonElement>('.ver-todas')) b.click();
    for (const d of el.querySelectorAll('details')) d.setAttribute('open', '');
    await f.whenStable();
    expect(el.textContent).not.toMatch(/\$|pesos|tarifa|importe|flete|costo|pago|monto/i);
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
