import { TestBed } from '@angular/core/testing';
import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { Viaje, ViajeCargado } from '../../core/api/operador-api.modelos';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { EntornoPruebas, configurar, crearEntorno, entrarComo, ponerEnLinea } from '../../testing/entorno-pruebas';
import { PanelAvanceComponent, TEXTO_GUARDADO_SIN_SENAL } from './panel-avance.component';

const salida = salidaEjemplo(new Date('2026-11-23T16:00:00Z'));
const vacio = salida.viajes[0];
const cargado = salida.viajes[1] as ViajeCargado;
const taller = salida.viajes[3];

async function montar(v: Viaje, e: EntornoPruebas = crearEntorno()) {
  configurar(e);
  await entrarComo();
  const f = TestBed.createComponent(PanelAvanceComponent);
  f.componentRef.setInput('viaje', v);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const textos = (sel: string) => [...el.querySelectorAll(sel)].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
  const clic = async (sel: string, texto: string) => {
    [...el.querySelectorAll<HTMLButtonElement>(sel)].find((b) => b.textContent!.trim() === texto)!.click();
    await vi.waitFor(async () => {
      await f.whenStable();
    });
  };
  /** Abre la hoja "Otro paso" y devuelve los pasos que ofrece. */
  const otrosPasos = async () => {
    await clic('button.otro-paso', 'Otro paso');
    return textos('.otros-lista button');
  };
  return { f, el, e, textos, clic, otrosPasos };
}

describe('PanelAvanceComponent: botón principal y fila Incidencia · Foto · Otro paso', () => {
  it('botón principal (72 px) en palabras del operador con su línea de ayuda; abajo, tres botones', async () => {
    const { el, textos, otrosPasos } = await montar(cargado);
    expect(textos('.paso-siguiente .ayuda')).toEqual(['Toque al salir hacia la carga']);
    expect(textos('.paso-siguiente .accion')).toEqual(['Voy por la carga']);
    const principal = el.querySelector('.paso-siguiente')!;
    expect(principal.classList).toContain('btn-principal');
    expect(principal.querySelector('svg')).not.toBeNull(); // la flecha, a la derecha
    expect(textos('.fila button')).toEqual(['Incidencia', 'Foto', 'Otro paso']);
    expect(el.querySelector('.otros-lista')).toBeNull(); // la lista está en su hoja
    expect(await otrosPasos()).toEqual([
      'Ya llegué a cargar',
      'Ya me están cargando',
      'Ya cargué',
      'Ya salí',
      'Ya llegué a descargar',
      'Ya me están descargando',
      'Ya descargué',
    ]);
    expect(el.querySelector('#titulo-otro-paso')!.textContent).toBe('Otro paso');
  });

  it('la línea de ayuda dice cuándo tocar: "Toque cuando termine la carga" → «Ya cargué»', async () => {
    const { textos } = await montar({ ...cargado, estatus: 'EnCarga' });
    expect(textos('.paso-siguiente')).toEqual(['Toque cuando termine la carga Ya cargué']);
  });

  it('si la oficina ya avanzó el viaje, ya no ofrece los pasos anteriores', async () => {
    const { textos, otrosPasos } = await montar({ ...cargado, estatus: 'EnTransito' });
    expect(textos('.paso-siguiente .accion')).toEqual(['Ya llegué a descargar']);
    expect(await otrosPasos()).toEqual(['Ya me están descargando', 'Ya descargué']);
  });

  it('viaje vacío con sus propios pasos: "Ya salí" y después "Ya llegué al taller"', async () => {
    const { textos, otrosPasos } = await montar(taller);
    expect(textos('.paso-siguiente .accion')).toEqual(['Ya salí']);
    expect(await otrosPasos()).toEqual(['Ya llegué al taller']);
  });

  it('sin otros pasos que saltar, "Otro paso" lo dice en vez de abrir una hoja vacía', async () => {
    const { el, clic } = await montar({ ...cargado, estatus: 'EnDescarga' });
    await clic('button.otro-paso', 'Otro paso');
    expect(el.querySelector('.otros-lista')).toBeNull();
    expect(TestBed.inject(MensajesService).mensaje()?.texto).toBe('No hay otros pasos que reportar en este viaje.');
  });

  it('saltar pasos avisa cuáles se saltan; al confirmar se guarda y se envía sin lapso', async () => {
    const { el, clic, otrosPasos } = await montar(cargado);
    await otrosPasos();
    await clic('.otros-lista button', 'Ya me están cargando');
    expect(el.querySelector('.otros-lista')).toBeNull(); // se cierra la hoja de pasos
    expect(el.querySelector('.hoja h2')!.textContent).toContain('¿Reportar «Ya me están cargando»?');
    expect(el.querySelector('.hoja .alerta-aviso')!.textContent).toContain('Se saltará: Voy por la carga, Ya llegué a cargar.');
    await clic('.hoja button', 'Enviar reporte');
    const cola = TestBed.inject(ColaReportesService);
    await vi.waitFor(() => expect(cola.reportes()).toHaveLength(1));
    expect(cola.reportes()[0].reporte).toMatchObject({ tipo: 'estatus', viajeId: cargado.id, estatus: 'EnCarga' });
    expect(cola.retenidos()).toEqual([]);
  });

  it('hito desde "Otro paso": avisa que quedará pendiente de confirmar por oficina', async () => {
    const { el, clic, otrosPasos } = await montar(cargado);
    await otrosPasos();
    await clic('.otros-lista button', 'Ya cargué');
    expect(el.querySelector('.hoja')!.textContent).toContain('quedará «Pendiente de confirmar por oficina»');
  });

  it('sin señal no es error: "Quedó guardado y se enviará solo cuando haya señal."', async () => {
    const e = crearEntorno();
    const { clic, otrosPasos } = await montar(cargado, e);
    ponerEnLinea(e, false);
    await otrosPasos();
    await clic('.otros-lista button', 'Ya me están cargando');
    await clic('.hoja button', 'Enviar reporte');
    await vi.waitFor(() => expect(TestBed.inject(MensajesService).mensaje()?.texto).toBe(TEXTO_GUARDADO_SIN_SENAL));
    expect(TestBed.inject(MensajesService).mensaje()?.tipo).toBe('exito');
  });

  it('incidencia "Otro" sin nota: mensaje visible y no se guarda; con nota sí', async () => {
    const { el, clic, f } = await montar(cargado);
    await clic('button.incidencia', 'Incidencia');
    expect(el.querySelector('#titulo-hoja')!.textContent).toBe('¿Qué pasó?');
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

  it('"Foto" abre la hoja de foto en un viaje cargado; en un vacío explica por qué no', async () => {
    const { el, clic } = await montar(cargado);
    await clic('button.foto', 'Foto');
    expect(el.querySelector('app-hoja-foto #titulo-foto')!.textContent).toBe('Agregar foto');
    TestBed.resetTestingModule();
    const otro = await montar(vacio);
    await otro.clic('button.foto', 'Foto');
    expect(otro.el.querySelector('app-hoja-foto')).toBeNull();
    expect(TestBed.inject(MensajesService).mensaje()?.texto).toBe('Las fotos de evidencia son para viajes cargados; este viaje es vacío.');
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
