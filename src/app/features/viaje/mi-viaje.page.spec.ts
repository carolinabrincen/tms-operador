import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { MiViajePage } from './mi-viaje.page';
import { ViajePage } from './viaje.page';
import { ESCALA_ETIQUETA } from '../../shared/ui/etiqueta-estatus.component';

const OPERADOR = 'ej-op-8112345678';

/** El operador reporta algo y después la oficina cierra la salida. */
async function reportarYCerrarSalida(): Promise<void> {
  configurar(crearEntorno());
  await entrarComo();
  const asignacion = TestBed.inject(AsignacionService);
  await asignacion.cargar();
  const cola = TestBed.inject(ColaReportesService);
  await cola.registrar({
    tipo: 'estatus',
    viajeId: 'ej-via-770',
    estatus: 'EnTransitoVacio',
    ocurrioEn: '2026-11-23T16:00:00Z',
    ubicacion: null,
    nota: null,
    resumen: 'Viaje 1',
  });
  await cola.inactivo();
  (TestBed.inject(OPERADOR_API) as OperadorApiEjemplo).cerrarSalida(OPERADOR);
  await asignacion.cargar();
}

describe('MiViajePage: el estatus actual es lo primero que se lee', () => {
  async function montar() {
    configurar(crearEntorno());
    await entrarComo();
    await TestBed.inject(AsignacionService).cargar();
    const f = TestBed.createComponent(MiViajePage);
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }

  it('encabezado azul: "Viaje 1 de 4 · Vacío", "Estatus actual", el estatus en grande (30 px) y la barra de avance', async () => {
    const el = await montar();
    const enc = el.querySelector('app-encabezado.encabezado-principal')!;
    expect(enc.querySelector('h1.enc-titulo-viaje')!.textContent!.trim()).toBe('Viaje 1 de 4 · Vacío');
    expect(enc.querySelector('.enc-rotulo')!.textContent).toContain('Estatus actual');
    expect(enc.querySelector('.ahora-etiqueta')!.textContent).toBe('Le toca');
    const etiqueta = enc.querySelector<HTMLElement>('app-etiqueta-estatus')!;
    expect(etiqueta.classList).toContain('etiqueta-encabezado');
    expect(etiqueta.textContent).toContain('Asignado');
    // De 28 a 32 px con el texto normal de 16 px, y lo más grande de todas las etiquetas.
    expect(ESCALA_ETIQUETA.encabezado * 16).toBeGreaterThanOrEqual(28);
    expect(ESCALA_ETIQUETA.encabezado * 16).toBeLessThanOrEqual(32);
    expect(ESCALA_ETIQUETA.encabezado).toBe(Math.max(...Object.values(ESCALA_ETIQUETA)));
    expect(etiqueta.style.fontSize).toBe(`calc(var(--texto-normal) * ${ESCALA_ETIQUETA.encabezado})`);
    const barra = enc.querySelector('[role=progressbar]')!;
    expect([barra.getAttribute('aria-valuenow'), barra.getAttribute('aria-valuemax')]).toEqual(['0', '2']); // vacío: Salí y Llegué
    expect(barra.querySelectorAll('.segmento')).toHaveLength(2);
    // La píldora "Datos de ejemplo" y "Salir" van dentro del encabezado.
    expect(enc.querySelector('.aviso-ejemplo')!.textContent).toBe('Datos de ejemplo');
    expect(enc.querySelector('.enc-salir')!.textContent!.trim()).toBe('Salir');
  });

  it('tarjeta montada sobre el encabezado con "Sale de" y "Llega a"; luego "Siguiente paso" con el botón principal', async () => {
    const el = await montar();
    const main = el.querySelector('main')!;
    const tarjeta = main.firstElementChild!;
    expect(tarjeta.classList).toContain('tarjeta-montada');
    expect([...tarjeta.querySelectorAll('.etiqueta-seccion')].map((e) => e.textContent)).toEqual(['Sale de', 'Llega a']);
    expect([...tarjeta.querySelectorAll('.lugar')].map((e) => e.textContent)).toEqual(['Patio Guadalupe, N.L.', 'Estación de diésel, Carr. Miguel Alemán km 12']);
    expect(tarjeta.querySelectorAll('svg.icono')).toHaveLength(2);
    const panel = main.querySelector('app-panel-avance')!;
    expect(panel.querySelector('.titulo-seccion')!.textContent).toBe('Siguiente paso');
    expect(panel.querySelector('.paso-siguiente')!.textContent!.trim()).toBe('Salí');
    expect(panel.textContent).not.toContain('Estatus:');
  });

  it('la barra de avance se llena con lo que el operador ya reportó', async () => {
    const el = await montar();
    await TestBed.inject(ColaReportesService).registrar({
      tipo: 'estatus',
      viajeId: 'ej-via-770',
      estatus: 'EnTransitoVacio',
      ocurrioEn: '2026-11-23T16:00:00Z',
      ubicacion: null,
      nota: null,
      resumen: 'Viaje 1',
    });
    await vi.waitFor(() => expect(el.querySelector('app-encabezado [role=progressbar]')!.getAttribute('aria-valuenow')).toBe('1'));
    expect(el.querySelectorAll('app-encabezado .segmento.hecho')).toHaveLength(1);
  });

  it('en la lista de viajes de la salida cada viaje trae la misma etiqueta, mediana', async () => {
    const el = await montar();
    const enLista = [...el.querySelectorAll('.viaje-enlace app-etiqueta-estatus')];
    expect(enLista).toHaveLength(4);
    for (const e of enLista) expect(e.classList).toContain('etiqueta-mediana');
  });
});

describe('Sin salida activa (la oficina la cerró o canceló)', () => {
  it('Mi viaje muestra "No tiene un viaje activo" y lleva a Mis reportes, que conserva lo reportado', async () => {
    await reportarYCerrarSalida();
    const f = TestBed.createComponent(MiViajePage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const tarjeta = el.querySelector('.sin-viaje')!;
    expect(tarjeta.querySelector('h2')!.textContent).toBe('No tiene un viaje activo');
    expect(tarjeta.querySelector('a[href="/reportes"]')!.textContent!.trim()).toBe('Ver mis reportes');
    expect(el.querySelector('app-panel-avance')).toBeNull();
    expect(el.textContent).not.toContain('Viajes de esta salida');
    expect(TestBed.inject(ColaReportesService).reportes()).toHaveLength(1);
  });

  it('el detalle de un viaje de esa salida dice que ya no está activo', async () => {
    await reportarYCerrarSalida();
    const f = TestBed.createComponent(ViajePage);
    f.componentRef.setInput('id', 'ej-via-770');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.alerta')!.textContent).toContain('Este viaje ya no está activo: la oficina cerró o canceló la salida.');
    expect(el.querySelector('.alerta a[href="/reportes"]')).not.toBeNull();
  });

  it('sin reportes en el teléfono no ofrece el botón de Mis reportes', async () => {
    configurar(crearEntorno());
    await entrarComo('8112340000');
    await TestBed.inject(AsignacionService).cargar();
    const f = TestBed.createComponent(MiViajePage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.sin-viaje h2')!.textContent).toBe('No tiene un viaje activo');
    expect(el.querySelector('.sin-viaje a')).toBeNull();
  });
});

describe('Detalle de un viaje cargado', () => {
  it('encabezado secundario con flecha de regreso; estatus actual en grande con barra; trayecto con cliente, citas y producto', async () => {
    configurar(crearEntorno());
    await entrarComo();
    await TestBed.inject(AsignacionService).cargar();
    const f = TestBed.createComponent(ViajePage);
    f.componentRef.setInput('id', 'ej-via-771');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('app-encabezado h1')!.textContent).toBe('Viaje 2 · Cargado');
    expect(el.querySelector('app-encabezado a.enc-volver')!.getAttribute('href')).toBe('/viaje');
    const estatus = el.querySelector('.tarjeta-estatus')!;
    expect(estatus.querySelector('.etiqueta-seccion')!.textContent).toBe('Estatus actual');
    expect(estatus.querySelector('app-etiqueta-estatus')!.classList).toContain('etiqueta-grande');
    expect(estatus.querySelector('[role=progressbar]')!.getAttribute('aria-valuemax')).toBe('8');
    const trayecto = el.querySelector('app-trayecto')!;
    expect(trayecto.textContent).toContain('Apodaca, N.L.');
    expect(trayecto.textContent).toContain('Saltillo, Coah.');
    expect(trayecto.textContent).toContain('Aceros del Norte (ejemplo)');
    expect(trayecto.textContent).toContain('Lámina rolada en caliente');
    expect(trayecto.querySelector('.citas')!.textContent).toContain('Carga:');
    // "Datos del viaje" no repite lo que ya está en el trayecto.
    const datos = el.querySelector('app-datos-viaje')!;
    expect(datos.textContent).not.toContain('Cliente');
    expect(datos.textContent).toContain('Toneladas programadas');
  });
});
