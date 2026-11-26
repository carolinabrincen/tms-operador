import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { CasetasService } from '../../core/hoja-ruta/casetas.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { EntornoPruebas, configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { HojaRutaPage } from './hoja-ruta.page';

/** El operador reporta los pasos del viaje 1 (vacío): el que toca pasa a ser el viaje 2 (cargado). */
async function terminarViaje1(): Promise<void> {
  const cola = TestBed.inject(ColaReportesService);
  for (const estatus of ['EnTransitoVacio', 'EnPatio'] as const) {
    await cola.registrar({ tipo: 'estatus', viajeId: 'ej-via-770', estatus, ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, resumen: 'Viaje 1' });
  }
  await cola.inactivo();
}

async function montar(e: EntornoPruebas = crearEntorno(), antes?: () => Promise<void>) {
  configurar(e);
  await entrarComo();
  await TestBed.inject(AsignacionService).cargar();
  if (antes) await antes();
  await TestBed.inject(HojaRutaService).cargar();
  const f = TestBed.createComponent(HojaRutaPage);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const limpio = (n: Element | null) => n?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  const tocar = async (sel: string) => {
    el.querySelector<HTMLButtonElement>(sel)!.click();
    await f.whenStable();
  };
  /** Abre la lista de tramos y toca el número `n` (1, 2, 3…). */
  const verTramo = async (n: number) => {
    await tocar('.ver-otros');
    el.querySelectorAll<HTMLButtonElement>('.tramo-opcion')[n - 1].click();
    await f.whenStable();
  };
  return { f, el, e, limpio, tocar, verTramo };
}

describe('HojaRutaPage: solo el tramo actual; los demás en una lista a un toque', () => {
  it('teléfonos con "Llamar" arriba, siempre visibles; luego "Tramo actual · 1 de 4" y una sola tarjeta de tramo', async () => {
    const { el, limpio } = await montar();
    expect(el.querySelector('app-encabezado h1')!.textContent).toBe('Hoja de ruta');
    expect(limpio(el.querySelector('app-encabezado .subtitulo'))).toBe('T-104 · al día 23 nov, 10:00 a. m.');
    const tels = [...el.querySelectorAll('.telefono')].map((t) => [limpio(t.querySelector('.etiqueta-seccion')), t.querySelector('a.llamar')!.getAttribute('href')]);
    expect(tels).toEqual([
      ['Oficina', 'tel:8155500100'],
      ['Tráfico, las 24 horas', 'tel:8005550199'],
    ]);
    const encabezado = el.querySelector('.tramo-encabezado')!;
    expect(limpio(encabezado)).toBe('Tramo actual · 1 de 4');
    expect(el.querySelector('.telefonos')!.compareDocumentPosition(encabezado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelectorAll('.tramo')).toHaveLength(1);
    expect(limpio(el.querySelector('.tramo .origen .nombre'))).toBe('Patio Guadalupe, N.L.');
    expect(limpio(el.querySelector('.tramo-titulo'))).toBe('Movimiento vacío');
    expect(limpio(el.querySelector('.ver-otros'))).toBe('Ver los otros tramos (3)');
    expect(el.querySelector('.viendo-otro')).toBeNull();
  });

  it('el tramo actual es el mismo viaje que toca en Mi viaje: al avanzar, al volver a entrar se ve el nuevo', async () => {
    const { el, limpio } = await montar(crearEntorno(), terminarViaje1);
    expect(limpio(el.querySelector('.tramo-encabezado'))).toBe('Tramo actual · 2 de 4');
    const t = el.querySelector('.tramo')!;
    expect(limpio(t.querySelector('.tramo-titulo'))).toBe('Viaje cargado');
    expect(limpio(t.querySelector('.distancia'))).toBe('96.5 km · 1 h 40 min');
    expect(limpio(t.querySelector('.origen .detalle'))).toBe('Planta · Av. Ejemplo 100, Parque Industrial, C.P. 66600');
    expect(limpio(t.querySelector('.destino .detalle'))).toBe('Cita: 23 nov, 1:00 p. m.');
    expect(limpio(t.querySelector('.parada-nombre'))).toBe('Descanso · Parador km 40');
    expect(limpio(t.querySelector('.caseta-nombre'))).toBe('Plaza Santa Catarina (ejemplo)');
    expect(t.querySelector('.abrir-mapa')).not.toBeNull();
    expect(t.querySelector('details.mas-datos')!.textContent).toContain('Aceros del Norte (ejemplo)');
  });

  it('la lista: número, origen → destino y estado en palabras con su icono (Terminado, Actual, Siguiente, Pendiente)', async () => {
    const { el, limpio, tocar } = await montar(crearEntorno(), terminarViaje1);
    await tocar('.ver-otros');
    expect(el.querySelector('#titulo-tramos')!.textContent).toBe('Tramos de la salida');
    const opciones = [...el.querySelectorAll('.tramo-opcion')];
    expect(opciones.map((o) => [limpio(o.querySelector('.tramo-numero')), limpio(o.querySelector('.tramo-recorrido')), limpio(o.querySelector('.tramo-estado'))])).toEqual([
      ['Tramo 1', 'Patio Guadalupe, N.L. → Estación de diésel, Carr. Miguel Alemán km 12', 'Terminado'],
      ['Tramo 2', 'Apodaca, N.L. → Saltillo, Coah.', 'Actual'],
      ['Tramo 3', 'Ramos Arizpe, Coah. → San Luis Potosí, S.L.P.', 'Siguiente'],
      ['Tramo 4', 'San Luis Potosí, S.L.P. → Taller Diésel del Norte, Guadalupe, N.L.', 'Pendiente'],
    ]);
    // Icono además del color: cada estado con su figura.
    expect(opciones.map((o) => o.classList.contains(`estado-${['terminado', 'actual', 'siguiente', 'pendiente'][opciones.indexOf(o)]}`))).toEqual([true, true, true, true]);
    for (const o of opciones) expect(o.querySelector('.tramo-icono svg')).not.toBeNull();
    expect(opciones[1].getAttribute('aria-current')).toBe('true');
  });

  it('al tocar otro tramo: se muestra ese con "Está viendo el tramo 3 de 4" y "Volver al tramo actual"', async () => {
    const { el, limpio, verTramo, tocar } = await montar();
    await verTramo(3);
    expect(el.querySelector('#titulo-tramos')).toBeNull(); // se cierra la lista
    expect(limpio(el.querySelector('.viendo-otro-texto'))).toBe('Está viendo el tramo 3 de 4.');
    expect(limpio(el.querySelector('.tramo-encabezado'))).toBe('Tramo 3 de 4');
    expect(el.querySelectorAll('.tramo')).toHaveLength(1);
    expect(limpio(el.querySelector('.tramo .origen .nombre'))).toBe('Ramos Arizpe, Coah.');
    expect(el.querySelector('.tramo .marca-peligro')!.textContent).toBe('MATERIAL PELIGROSO');
    await tocar('.volver-actual');
    expect(el.querySelector('.viendo-otro')).toBeNull();
    expect(limpio(el.querySelector('.tramo-encabezado'))).toBe('Tramo actual · 1 de 4');
    // Elegir en la lista el actual también quita el aviso.
    await verTramo(2);
    await verTramo(1);
    expect(el.querySelector('.viendo-otro')).toBeNull();
  });

  it('un solo tramo: sin botón de otros tramos ni contador', async () => {
    const { el, limpio } = await montar(crearEntorno(), async () => {
      const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
      const hoja = await api.obtenerHojaRuta();
      vi.spyOn(api, 'obtenerHojaRuta').mockResolvedValue({ ...hoja!, itinerario: [hoja!.itinerario[0]] });
    });
    expect(limpio(el.querySelector('.tramo-encabezado'))).toBe('Tramo actual');
    expect(el.querySelector('.ver-otros')).toBeNull();
    expect(el.querySelectorAll('.tramo')).toHaveLength(1);
  });

  it('SOLO la próxima caseta con "Ya la pasé"; avanza y se recuerda por tramo; al final, "Sin casetas pendientes"', async () => {
    const { f, el, e, limpio, verTramo } = await montar();
    await verTramo(3);
    const t = () => el.querySelector('.tramo')!;
    expect(limpio(t().querySelector('.caseta .etiqueta-seccion'))).toBe('Próxima caseta · 1 de 2');
    expect(limpio(t().querySelector('.caseta-nombre'))).toBe('Plaza Los Chorros (ejemplo)');
    expect(t().textContent).not.toContain('Plaza Huizache');
    t().querySelector<HTMLButtonElement>('.ya-la-pase')!.click();
    await f.whenStable();
    expect(limpio(t().querySelector('.caseta .etiqueta-seccion'))).toBe('Próxima caseta · 2 de 2');
    t().querySelector<HTMLButtonElement>('.ya-la-pase')!.click();
    await f.whenStable();
    expect(limpio(t().querySelector('.sin-pendientes'))).toBe('Sin casetas pendientes');
    // Se recuerda en el teléfono para ese tramo (no para los demás).
    TestBed.resetTestingModule();
    const otra = await montar(crearEntorno({ almacenLocal: e.almacenLocal, idb: e.idb }));
    expect(otra.el.querySelector('.tramo .caseta')).toBeNull(); // el tramo 1 no tiene casetas
    await otra.verTramo(3);
    expect(limpio(otra.el.querySelector('.tramo .sin-pendientes'))).toBe('Sin casetas pendientes');
    await otra.verTramo(2);
    expect(limpio(otra.el.querySelector('.tramo .caseta-nombre'))).toBe('Plaza Santa Catarina (ejemplo)');
  });

  it('"Ver todas" muestra todas las casetas del tramo con cuáles ya pasó; se puede regresar una marcada por error', async () => {
    const { f, el, limpio, verTramo } = await montar();
    TestBed.inject(CasetasService).pasar('SAL-2026-00418', 3, 2);
    await verTramo(3);
    const t = el.querySelector('.tramo')!;
    const ver = t.querySelector<HTMLButtonElement>('.ver-todas')!;
    expect(limpio(ver)).toBe('Ver todas (2)');
    ver.click();
    await f.whenStable();
    expect(ver.getAttribute('aria-expanded')).toBe('true');
    expect([...t.querySelectorAll('.lista-casetas li')].map(limpio)).toEqual([
      'Plaza Los Chorros (ejemplo) (Saltillo - Matehuala) Pasada',
      'Plaza Huizache (ejemplo) (Matehuala - San Luis Potosí) Próxima',
    ]);
    t.querySelector<HTMLButtonElement>('.regresar-caseta')!.click();
    await f.whenStable();
    expect(limpio(t.querySelector('.caseta-nombre'))).toBe('Plaza Los Chorros (ejemplo)');
  });

  it('"Abrir en mapa" con la liga https del servidor, en otra pestaña', async () => {
    const { el, verTramo } = await montar();
    expect(el.querySelector('.abrir-mapa')).toBeNull(); // el tramo 1 no trae ruta
    await verTramo(2);
    const mapa = el.querySelector<HTMLAnchorElement>('.abrir-mapa')!;
    expect(mapa.href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    expect(mapa.target).toBe('_blank');
    expect(mapa.rel).toContain('noopener');
  });

  it('datos de la salida y la unidad, al final', async () => {
    const { el } = await montar();
    expect(el.querySelector('#titulo-empresa')!.textContent).toBe('Transportes de Ejemplo del Norte');
    expect(el.textContent).toContain('T-104 · Placas 41-AK-7R');
    expect(el.querySelector('.remolque dd')!.textContent).toBe('R-221 · Placas 12-UP-3X');
  });

  it('nunca muestra dinero (en ningún tramo, con la lista y las casetas abiertas)', async () => {
    const { f, el, verTramo, tocar } = await montar();
    for (const n of [1, 2, 3, 4]) {
      await verTramo(n);
      for (const b of el.querySelectorAll<HTMLButtonElement>('.ver-todas')) b.click();
      for (const d of el.querySelectorAll('details')) d.setAttribute('open', '');
      await f.whenStable();
      expect(el.textContent).not.toMatch(/\$|pesos|tarifa|importe|flete|costo|pago|monto/i);
    }
    await tocar('.ver-otros');
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
    expect(el.querySelectorAll('.tramo')).toHaveLength(1);
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
    expect(el.querySelector('.ver-otros')).toBeNull();
  });
});
