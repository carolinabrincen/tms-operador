import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { MiViajePage } from './mi-viaje.page';
import { ViajePage } from './viaje.page';

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

  it('en "Le toca": título, luego la etiqueta grande del estatus, luego la ruta; sin el renglón chico "Estatus:"', async () => {
    const el = await montar();
    const tarjeta = el.querySelector('.tarjeta-destacada')!;
    const orden = [...tarjeta.children].map((n) => n.tagName.toLowerCase() + (n.classList.contains('ruta') ? '.ruta' : ''));
    const iTitulo = orden.indexOf('h2');
    expect(orden[iTitulo + 1]).toBe('app-etiqueta-estatus');
    expect(orden[iTitulo + 2]).toBe('p.ruta');
    const etiqueta = tarjeta.querySelector('app-etiqueta-estatus')!;
    expect(etiqueta.classList).toContain('etiqueta-grande');
    expect(etiqueta.textContent).toContain('Asignado');
    expect(tarjeta.querySelector('app-panel-avance')!.textContent).not.toContain('Estatus:');
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
