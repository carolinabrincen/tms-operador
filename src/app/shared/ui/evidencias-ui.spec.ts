import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { ViajeCargado } from '../../core/api/operador-api.modelos';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { ViajePage } from '../../features/viaje/viaje.page';
import { MiViajePage } from '../../features/viaje/mi-viaje.page';
import { configurar, crearEntorno, entrarComo, fotoJpeg } from '../../testing/entorno-pruebas';
import { EvidenciasViajeComponent } from './evidencias-viaje.component';
import { HojaFotoComponent } from './hoja-foto.component';

const CARGADO = 'ej-via-771';
const salida = salidaEjemplo(new Date('2026-11-23T16:00:00Z'));
const cargado = salida.viajes[1] as ViajeCargado;

/** jsdom no tiene URL.createObjectURL: se simula para poder mostrar blobs. */
function simularUrls() {
  let n = 0;
  const crear = vi.fn(() => `blob:prueba/${++n}`);
  const revocar = vi.fn();
  Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
  return { crear, revocar };
}

async function iniciar() {
  configurar(crearEntorno());
  await entrarComo();
  await TestBed.inject(AsignacionService).cargar();
  await TestBed.inject(ColaEvidenciasService).listo();
}

/** Elige un archivo en un <input type=file> (jsdom no deja asignar `files` directamente). */
async function elegirArchivo(input: HTMLInputElement, archivo: File) {
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('Fotos de evidencia en pantalla', () => {
  beforeEach(() => simularUrls());
  afterEach(() => {
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it('detalle de un viaje cargado: "Agregar foto"; la galería muestra la de la oficina solo como renglón, sin imagen ni descarga', async () => {
    await iniciar();
    const archivo = vi.spyOn(TestBed.inject(OPERADOR_API), 'archivoEvidencia');
    const f = TestBed.createComponent(ViajePage);
    f.componentRef.setInput('id', CARGADO);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.galeria-item')).not.toBeNull();
    });
    expect(el.querySelector('.agregar-foto')!.textContent).toContain('Agregar foto');
    const oficina = el.querySelector('.galeria-item.de-oficina')!;
    expect(oficina.textContent).toContain('Carta Porte firmada');
    expect(oficina.querySelector('.foto-oficina')!.textContent).toBe('Subida por la oficina');
    expect(oficina.querySelector('img, .ver-foto')).toBeNull();
    expect(archivo).not.toHaveBeenCalled();
  });

  it('un viaje en vacío no tiene sección de fotos (P8 a)', async () => {
    await iniciar();
    const f = TestBed.createComponent(ViajePage);
    f.componentRef.setInput('id', 'ej-via-770');
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('app-evidencias-viaje')).toBeNull();
  });

  it('viaje cancelado: no ofrece "Agregar foto" y dice que la oficina puede subirla', async () => {
    await iniciar();
    const f = TestBed.createComponent(EvidenciasViajeComponent);
    f.componentRef.setInput('viaje', { ...cargado, estatus: 'Cancelado' });
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.agregar-foto')).toBeNull();
    expect(el.querySelector('.foto-no-admitida')!.textContent).toContain('la oficina puede subirla');
  });

  it('galería: una foto suya se pide con el token al tocar "Ver foto" y se muestra como blob', async () => {
    await iniciar();
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    await api.subirEvidencia(fotoJpeg(5), { id: 'mia-1', viajeId: CARGADO, tipo: 'Sellos', descripcion: null, nota: null, reporteId: null, tomadaEn: null, ubicacion: null });
    const archivo = vi.spyOn(api, 'archivoEvidencia');
    const f = TestBed.createComponent(EvidenciasViajeComponent);
    f.componentRef.setInput('viaje', cargado);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.ver-foto')).not.toBeNull();
    });
    expect(archivo).not.toHaveBeenCalled(); // no se descarga sola (ahorra datos)
    el.querySelector<HTMLButtonElement>('.ver-foto')!.click();
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector<HTMLImageElement>('.foto-servidor')?.getAttribute('src')).toMatch(/^blob:prueba\//);
    });
    expect(archivo).toHaveBeenCalledWith('mia-1');
  });

  it('galería: si el archivo da 404 (anulada), dice que ya no está disponible, sin error', async () => {
    await iniciar();
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    await api.subirEvidencia(fotoJpeg(5), { id: 'mia-1', viajeId: CARGADO, tipo: 'Sellos', descripcion: null, nota: null, reporteId: null, tomadaEn: null, ubicacion: null });
    vi.spyOn(api, 'archivoEvidencia').mockResolvedValueOnce(null);
    const f = TestBed.createComponent(EvidenciasViajeComponent);
    f.componentRef.setInput('viaje', cargado);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.ver-foto')).not.toBeNull();
    });
    el.querySelector<HTMLButtonElement>('.ver-foto')!.click();
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.textContent).toContain('La foto ya no está disponible.');
    });
    expect(el.querySelector('.alerta-error')).toBeNull();
  });

  it('agregar foto: con Otro pide descripción; guarda la foto reducida en la cola con tipo, descripción, nota y hora', async () => {
    await iniciar();
    const f = TestBed.createComponent(HojaFotoComponent);
    f.componentRef.setInput('viaje', cargado);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const cola = TestBed.inject(ColaEvidenciasService);
    const boton = (texto: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === texto)!;

    boton('Guardar y enviar').click();
    await f.whenStable();
    expect(el.querySelector('.campo-error')!.textContent).toBe('Tome la foto o elíjala de la galería.');

    const [camara] = el.querySelectorAll<HTMLInputElement>('input[type=file]');
    expect(camara.getAttribute('capture')).toBe('environment');
    await elegirArchivo(camara, new File([new Uint8Array(10)], 'IMG_1.jpg', { type: 'image/jpeg' }));
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.vista-previa')).not.toBeNull();
    });
    boton('Otro').click();
    await f.whenStable();
    boton('Guardar y enviar').click();
    await f.whenStable();
    expect(el.querySelector('.campo-error')!.textContent).toBe('En “Otro” escriba qué es la foto.');
    expect(cola.fotos()).toHaveLength(0);

    const desc = el.querySelector<HTMLInputElement>('#descripcion-foto')!;
    desc.value = 'Llanta ponchada';
    desc.dispatchEvent(new Event('input'));
    const nota = el.querySelector<HTMLTextAreaElement>('#nota-foto')!;
    nota.value = 'Km 40';
    nota.dispatchEvent(new Event('input'));
    await f.whenStable();
    boton('Guardar y enviar').click();
    await vi.waitFor(() => expect(cola.fotos()).toHaveLength(1));
    const guardada = cola.fotos()[0];
    expect(guardada.datos).toMatchObject({ viajeId: CARGADO, tipo: 'Otro', descripcion: 'Llanta ponchada', nota: 'Km 40', reporteId: null, tomadaEn: '2026-11-23T16:00:00Z' });
    expect(guardada.tipoContenido).toBe('image/jpeg'); // la reducida (herramientas de prueba)
  });

  it('una foto de la galería con fecha futura (reloj del teléfono mal) va sin hora de toma', async () => {
    await iniciar();
    const f = TestBed.createComponent(HojaFotoComponent);
    f.componentRef.setInput('viaje', cargado);
    f.componentRef.setInput('tipoInicial', 'Sellos');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const galeria = el.querySelectorAll<HTMLInputElement>('input[type=file]')[1];
    expect(galeria.hasAttribute('capture')).toBe(false);
    const futuro = new Date('2026-11-23T17:00:00Z').getTime();
    await elegirArchivo(galeria, new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg', lastModified: futuro }));
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.vista-previa')).not.toBeNull();
    });
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Guardar y enviar')!.click();
    const cola = TestBed.inject(ColaEvidenciasService);
    await vi.waitFor(() => expect(cola.fotos()).toHaveLength(1));
    expect(cola.fotos()[0].datos.tomadaEn).toBeNull();
  });

  it('un PDF no se acepta como foto', async () => {
    await iniciar();
    const f = TestBed.createComponent(HojaFotoComponent);
    f.componentRef.setInput('viaje', cargado);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    await elegirArchivo(el.querySelectorAll<HTMLInputElement>('input[type=file]')[1], new File(['%PDF'], 'carta.pdf', { type: 'application/pdf' }));
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.campo-error')?.textContent).toBe('Elija una foto (no un documento).');
    });
  });

  it('tras reportar Descargado, Mi viaje sugiere la foto del acuse ligada a ese reporte; "Ahora no" la quita', async () => {
    await iniciar();
    const reportes = TestBed.inject(ColaReportesService);
    const r = await reportes.registrar({ tipo: 'estatus', viajeId: CARGADO, estatus: 'Descargado', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, resumen: 'Viaje 2' });
    const f = TestBed.createComponent(MiViajePage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const sugerencia = el.querySelector('.sugerencia-acuse')!;
    expect(sugerencia.textContent).toContain('Viaje 2: ya reportó “Ya descargué”.');
    el.querySelector<HTMLButtonElement>('.tomar-acuse')!.click();
    await f.whenStable();
    const hoja = el.querySelector('app-hoja-foto')!;
    expect(hoja.querySelector('h2')!.textContent).toBe('Foto del acuse de recibido');
    expect(hoja.querySelector('[aria-checked="true"]')!.textContent!.trim()).toBe('Acuse de recibido');
    // Se cancela sin tomarla: la sugerencia sigue (no obliga, pero tampoco se pierde)…
    [...hoja.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Cancelar')!.click();
    await f.whenStable();
    expect(el.querySelector('.sugerencia-acuse')).not.toBeNull();
    // …hasta que dice "Ahora no".
    el.querySelector<HTMLButtonElement>('.ahora-no')!.click();
    await f.whenStable();
    expect(el.querySelector('.sugerencia-acuse')).toBeNull();
    expect(TestBed.inject(ColaEvidenciasService).sugerenciasOmitidas().has(r.id)).toBe(true);
  });

  it('la foto del acuse queda ligada al Descargado (reporteId)', async () => {
    await iniciar();
    const reportes = TestBed.inject(ColaReportesService);
    const r = await reportes.registrar({ tipo: 'estatus', viajeId: CARGADO, estatus: 'Descargado', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, resumen: 'Viaje 2' });
    const f = TestBed.createComponent(HojaFotoComponent);
    f.componentRef.setInput('viaje', cargado);
    f.componentRef.setInput('tipoInicial', 'AcuseRecibido');
    f.componentRef.setInput('reporteId', r.id);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    await elegirArchivo(el.querySelector<HTMLInputElement>('input[type=file]')!, new File([new Uint8Array(10)], 'acuse.jpg', { type: 'image/jpeg' }));
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.vista-previa')).not.toBeNull();
    });
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Guardar y enviar')!.click();
    const cola = TestBed.inject(ColaEvidenciasService);
    await vi.waitFor(() => expect(cola.fotos()).toHaveLength(1));
    expect(cola.fotos()[0].datos).toMatchObject({ tipo: 'AcuseRecibido', reporteId: r.id });
  });
});
