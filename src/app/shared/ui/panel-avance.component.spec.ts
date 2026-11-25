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
  /** Abre la hoja "Otro paso" y devuelve los pasos que ofrece. */
  const otrosPasos = async () => {
    await clic('button.otro-paso', 'Otro paso');
    return textos('.otros-lista button');
  };
  return { f, el, textos, clic, otrosPasos };
}

describe('PanelAvanceComponent: guía del operador sobre un viaje', () => {
  it('"Siguiente paso": botón principal con flecha; "Otro paso" (los demás hacia adelante) e "Incidencia" a la mitad', async () => {
    const { el, textos, otrosPasos } = await montar(cargado);
    expect(el.querySelector('.titulo-seccion')!.textContent).toBe('Siguiente paso');
    expect(textos('.paso-siguiente')).toEqual(['Voy a cargar']);
    const principal = el.querySelector('.paso-siguiente')!;
    expect(principal.classList).toContain('btn-grande');
    expect(principal.querySelector('svg')).not.toBeNull(); // la flecha, a la derecha
    expect(textos('.secundarias button')).toEqual(['Otro paso', 'Incidencia']);
    expect(el.querySelector('.secundarias')!.classList).not.toContain('una-sola');
    expect(el.querySelector('.otros-lista')).toBeNull(); // la lista está en su hoja
    expect(await otrosPasos()).toEqual([
      'Llegué a cargar',
      'Me están cargando',
      'Ya cargué y tengo documentos',
      'Voy en camino a descargar',
      'Llegué a descargar',
      'Me están descargando',
      'Ya descargué',
    ]);
    expect(el.querySelector('#titulo-otro-paso')!.textContent).toBe('Otro paso (puede saltar)');
  });

  it('si la oficina ya avanzó el viaje, ya no ofrece los pasos anteriores', async () => {
    const { el, textos, otrosPasos } = await montar({ ...cargado, estatus: 'EnTransito' });
    expect(textos('.paso-siguiente')).toEqual(['Llegué a descargar']);
    expect(await otrosPasos()).toEqual(['Me están descargando', 'Ya descargué']);
    // El renglón chico "Estatus: …" ya no está en el panel: el estatus lo muestra la pantalla, en grande.
    expect(el.textContent).not.toContain('Estatus:');
  });

  it('vacío cuyo último tramo es a Taller: "Salí" y después "Llegué al taller"', async () => {
    const { textos, otrosPasos } = await montar(taller);
    expect(textos('.paso-siguiente')).toEqual(['Salí']);
    expect(await otrosPasos()).toEqual(['Llegué al taller']);
  });

  it('sin otros pasos que saltar: "Incidencia" ocupa todo el ancho', async () => {
    const { el, textos } = await montar({ ...cargado, estatus: 'EnDescarga' });
    expect(textos('.paso-siguiente')).toEqual(['Ya descargué']);
    expect(textos('.secundarias button')).toEqual(['Incidencia']);
    expect(el.querySelector('.secundarias')!.classList).toContain('una-sola');
  });

  it('saltar pasos avisa cuáles se saltan; al confirmar se guarda el reporte', async () => {
    const { el, clic, otrosPasos } = await montar(cargado);
    await otrosPasos();
    await clic('.otros-lista button', 'Me están cargando');
    expect(el.querySelector('.otros-lista')).toBeNull(); // se cierra la hoja de pasos
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
    await clic('button.incidencia', 'Incidencia');
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

  it('viaje cancelado por la oficina: se dice y no ofrece reportes (ni estatus ni incidencia)', async () => {
    const { el } = await montar({ ...cargado, estatus: 'Cancelado' });
    expect(el.querySelector('.paso-siguiente')).toBeNull();
    expect(el.querySelector('button.incidencia')).toBeNull();
    expect(el.textContent).toContain('La oficina canceló este viaje.');
  });

  it('viaje cerrado: sin botones de pasos ni de incidencia', async () => {
    const { el } = await montar({ ...cargado, estatus: 'Cerrado' });
    expect(el.querySelector('.paso-siguiente')).toBeNull();
    expect(el.querySelector('button.incidencia')).toBeNull();
    expect(el.textContent).toContain('Este viaje ya está cerrado.');
  });
});
