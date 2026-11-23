import { TestBed } from '@angular/core/testing';
import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { Viaje, ViajeCargado } from '../../core/api/operador-api.modelos';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { PanelAvanceComponent } from './panel-avance.component';

const salida = salidaEjemplo(new Date('2026-11-23T16:00:00Z'));
const cargado = salida.viajes[1] as ViajeCargado;
const taller = salida.viajes[3];

async function montar(v: Viaje) {
  configurar(crearEntorno());
  await entrarComo();
  const f = TestBed.createComponent(PanelAvanceComponent);
  f.componentRef.setInput('viaje', v);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const textos = (sel: string) => [...el.querySelectorAll(sel)].map((b) => b.textContent!.trim());
  const clic = async (sel: string, texto: string) => {
    [...el.querySelectorAll<HTMLButtonElement>(sel)].find((b) => b.textContent!.trim() === texto)!.click();
    await f.whenStable();
  };
  return { f, el, textos, clic };
}

describe('PanelAvanceComponent: guía del operador sobre un viaje', () => {
  it('siguiente paso grande; los demás hacia adelante en la lista para saltar; incidencia siempre visible', async () => {
    const { textos } = await montar(cargado);
    expect(textos('.paso-siguiente')).toEqual(['Voy a cargar']);
    expect(textos('.otros-lista button')).toEqual([
      'Llegué a cargar',
      'Me están cargando',
      'Ya cargué y tengo documentos',
      'Voy en camino a descargar',
      'Llegué a descargar',
      'Me están descargando',
      'Ya descargué',
    ]);
    expect(textos('button.incidencia')).toEqual(['⚠ Reportar incidencia']);
  });

  it('si la oficina ya avanzó el viaje, ya no ofrece los pasos anteriores', async () => {
    const { textos, el } = await montar({ ...cargado, estatus: 'EnTransito' });
    expect(textos('.paso-siguiente')).toEqual(['Llegué a descargar']);
    expect(textos('.otros-lista button')).toEqual(['Me están descargando', 'Ya descargué']);
    expect(el.querySelector('.panel-estatus')!.textContent).toContain('En tránsito');
  });

  it('vacío cuyo último tramo es a Taller: "Salí" y después "Llegué al taller"', async () => {
    const { textos } = await montar(taller);
    expect(textos('.paso-siguiente')).toEqual(['Salí']);
    expect(textos('.otros-lista button')).toEqual(['Llegué al taller']);
  });

  it('saltar pasos avisa cuáles se saltan; al confirmar se guarda el reporte', async () => {
    const { el, clic } = await montar(cargado);
    await clic('.otros-lista button', 'Me están cargando');
    expect(el.querySelector('.hoja h2')!.textContent).toContain('¿Reportar “Me están cargando”?');
    expect(el.querySelector('.hoja .alerta-aviso')!.textContent).toContain('Se saltará: Voy a cargar, Llegué a cargar.');
    await clic('.hoja button', 'Enviar reporte');
    const cola = TestBed.inject(ColaReportesService);
    await vi.waitFor(() => expect(cola.reportes()).toHaveLength(1));
    expect(cola.reportes()[0].reporte).toMatchObject({ tipo: 'estatus', viajeId: cargado.id, estatus: 'EnCarga' });
  });

  it('hito: avisa que quedará pendiente de confirmar por oficina', async () => {
    const { el, clic } = await montar({ ...cargado, estatus: 'EnCarga' });
    await clic('.paso-siguiente', 'Ya cargué y tengo documentos');
    expect(el.querySelector('.hoja')!.textContent).toContain('quedará “Pendiente de confirmar por oficina”');
  });

  it('incidencia "Otro" sin nota: mensaje visible y no se guarda; con nota sí', async () => {
    const { el, clic, f } = await montar(cargado);
    await clic('button.incidencia', '⚠ Reportar incidencia');
    await clic('.opciones button', 'Otro');
    await clic('.hoja button', 'Enviar reporte');
    expect(el.querySelector('.hoja .campo-error')!.textContent).toBe('En “Otro” escriba en la nota qué pasó.');
    const cola = TestBed.inject(ColaReportesService);
    expect(cola.reportes()).toHaveLength(0);
    const nota = el.querySelector<HTMLTextAreaElement>('.hoja textarea')!;
    nota.value = 'Lluvia fuerte, me orillé';
    nota.dispatchEvent(new Event('input'));
    await f.whenStable();
    await clic('.hoja button', 'Enviar reporte');
    await vi.waitFor(() => expect(cola.reportes()).toHaveLength(1));
    expect(cola.reportes()[0].reporte).toMatchObject({ tipo: 'incidencia', incidencia: 'Otro', nota: 'Lluvia fuerte, me orillé' });
  });

  it('viaje cerrado: sin botones de pasos ni de incidencia', async () => {
    const { el } = await montar({ ...cargado, estatus: 'Cerrado' });
    expect(el.querySelector('.paso-siguiente')).toBeNull();
    expect(el.querySelector('button.incidencia')).toBeNull();
    expect(el.textContent).toContain('Este viaje ya está cerrado.');
  });
});
