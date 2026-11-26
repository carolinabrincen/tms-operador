import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { EstatusViaje } from '../../core/api/operador-api.modelos';
import { CasetasService } from '../../core/hoja-ruta/casetas.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { ColaReportesService, LAPSO_DESHACER_MS } from '../../core/reportes/cola-reportes.service';
import { CLAVE_UBICACION_EXPLICADA } from '../../core/ubicacion/ubicacion.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { EntornoPruebas, configurar, crearEntorno, entrarComo, ponerEnLinea } from '../../testing/entorno-pruebas';
import { MiViajePage } from './mi-viaje.page';
import { ViajePage } from './viaje.page';

const OPERADOR = 'ej-op-8112345678';
const LAPSO = 1000;

/** Reporta un paso sin lapso (como lo haría "Otro paso"). */
function reportar(viajeId: string, estatus: EstatusViaje) {
  return TestBed.inject(ColaReportesService).registrar({ tipo: 'estatus', viajeId, estatus, ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, resumen: 'Viaje' });
}

/** El operador reporta algo y después la oficina cierra la salida. */
async function reportarYCerrarSalida(): Promise<void> {
  configurar(crearEntorno());
  await entrarComo();
  const asignacion = TestBed.inject(AsignacionService);
  await asignacion.cargar();
  await reportar('ej-via-770', 'EnTransitoVacio');
  await TestBed.inject(ColaReportesService).inactivo();
  (TestBed.inject(OPERADOR_API) as OperadorApiEjemplo).cerrarSalida(OPERADOR);
  await asignacion.cargar();
}

async function montar(e: EntornoPruebas = crearEntorno()) {
  // La ubicación ya se explicó antes: el botón principal guarda directo, sin hoja.
  e.almacenLocal.setItem(CLAVE_UBICACION_EXPLICADA, '1');
  configurar(e, [{ provide: LAPSO_DESHACER_MS, useValue: LAPSO }]);
  await entrarComo();
  await TestBed.inject(AsignacionService).cargar();
  const f = TestBed.createComponent(MiViajePage);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const texto = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  return { f, el, e, texto, estable: () => f.whenStable() };
}

describe('MiViajePage (referencia aprobada): paso actual resaltado y botón principal en palabras del operador', () => {
  it('orden: barra, paso actual, origen y destino con la hoja de ruta, y abajo el botón principal y la fila de tres', async () => {
    const { el, texto } = await montar();
    const main = el.querySelector('main')!;
    const orden = ['app-paso-actual', '.tarjeta-ruta', 'app-incidencias-abiertas', 'app-panel-avance'].map((s) => main.querySelector(s)!);
    for (let i = 1; i < orden.length; i++) expect(orden[i - 1].compareDocumentPosition(orden[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('app-encabezado.encabezado-principal')).not.toBeNull();
    // Paso actual: "Usted está aquí · paso N de M", el estatus con su nombre formal y "desde".
    expect(texto('.aqui')).toBe('Usted está aquí · paso 1 de 4');
    expect(texto('.estatus')).toBe('Asignado');
    expect(texto('.desde')).toBe('desde 9:00 a. m.');
    expect([...el.querySelectorAll('.etiquetas span')].map((s) => s.textContent)).toEqual(['Asignado', 'En tránsito', 'En patio', 'Cerrado']);
    expect(el.querySelectorAll('.pista .marcador')).toHaveLength(1);
    // Origen y destino; tocarlos lleva al detalle. El vacío no tiene casetas: solo "Hoja de ruta".
    const tarjeta = el.querySelector('.tarjeta-ruta')!;
    expect([...tarjeta.querySelectorAll('.lugar .nombre')].map((n) => n.textContent)).toEqual(['Patio Guadalupe, N.L.', 'Estación de diésel, Carr. Miguel Alemán km 12']);
    expect(tarjeta.querySelector('a.ver-detalle')!.getAttribute('href')).toBe('/viaje/ej-via-770');
    expect(texto('.renglon-hoja')).toBe('Hoja de ruta');
    // Botón principal (72 px): línea de ayuda arriba y el paso en palabras del operador.
    const principal = el.querySelector('.paso-siguiente')!;
    expect(principal.classList).toContain('btn-principal');
    expect(texto('.paso-siguiente .ayuda')).toBe('Toque al salir');
    expect(texto('.paso-siguiente .accion')).toBe('Ya salí');
    expect([...el.querySelectorAll('.fila button')].map((b) => b.textContent!.trim())).toEqual(['Incidencia', 'Foto', 'Otro paso']);
    // La acción principal va fija sobre el menú (nunca queda fuera de la vista); la pantalla deja lugar para ella.
    expect(el.querySelector('app-panel-avance')!.classList).toContain('fija');
    expect(el.querySelector('.fija .panel .paso-siguiente')).not.toBeNull();
    expect(el.querySelector('.fija .panel .fila')).not.toBeNull();
    // Sin medir la pantalla (pruebas), el estatus corto va a 40 px en un renglón.
    const estatus = el.querySelector<HTMLElement>('.estatus')!;
    expect(estatus.style.fontSize).toBe('2.5rem');
    expect(estatus.classList).not.toContain('dos-renglones');
  });

  it('lo que el operador ya reportó mueve el marcador y el estatus de arriba (con su aclaración si no se ha enviado)', async () => {
    const { e, texto, estable } = await montar();
    ponerEnLinea(e, false);
    await reportar('ej-via-770', 'EnTransitoVacio');
    await estable();
    expect(texto('.aqui')).toBe('Usted está aquí · paso 2 de 4');
    expect(texto('.estatus')).toBe('En tránsito (vacío)');
    expect(texto('.marca-pendiente')).toContain('Pendiente de enviar');
    expect(texto('.paso-siguiente .accion')).toBe('Ya llegué');
  });

  it('botón principal: se guarda y muestra "Guardado: «Ya salí», 10:00 a. m." con "Deshacer", que lo cancela sin enviar nada', async () => {
    const { el, texto, estable } = await montar();
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    const cola = TestBed.inject(ColaReportesService);
    el.querySelector<HTMLButtonElement>('.paso-siguiente')!.click();
    await vi.waitFor(
      async () => {
        await estable();
        expect(texto('.guardado-texto')).toBe('Guardado: «Ya salí», 10:00 a. m.');
      },
      { timeout: 900 },
    );
    expect(el.querySelector('.paso-siguiente')).toBeNull(); // el aviso ocupa su lugar
    expect(cola.reportes()).toHaveLength(1); // ya está guardado en el teléfono
    el.querySelector<HTMLButtonElement>('.deshacer')!.click();
    await vi.waitFor(async () => {
      await estable();
      expect(el.querySelector('.guardado')).toBeNull();
    });
    expect(cola.reportes()).toEqual([]);
    await new Promise((ok) => setTimeout(ok, LAPSO * 2));
    await cola.inactivo();
    expect(api.totalRecibidos).toBe(0);
    expect(texto('.paso-siguiente .accion')).toBe('Ya salí');
  });

  it('pasado el lapso se envía solo y el botón ofrece el paso siguiente', async () => {
    const { el, texto, estable } = await montar();
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    el.querySelector<HTMLButtonElement>('.paso-siguiente')!.click();
    await vi.waitFor(async () => {
      await estable();
      expect(el.querySelector('.guardado')).not.toBeNull();
    });
    expect(api.totalRecibidos).toBe(0);
    await vi.waitFor(
      async () => {
        await estable();
        expect(api.totalRecibidos).toBe(1);
        expect(el.querySelector('.guardado')).toBeNull();
      },
      { timeout: 4000 },
    );
    expect(texto('.paso-siguiente .accion')).toBe('Ya llegué');
  });

  it('"Hoja de ruta · próxima caseta: …" del viaje activo; "Ya la pasé" avanza y al final "sin casetas pendientes"', async () => {
    const { texto, estable } = await montar();
    await reportar('ej-via-770', 'EnTransitoVacio');
    await reportar('ej-via-770', 'EnPatio');
    await TestBed.inject(HojaRutaService).cargar();
    await estable();
    expect(texto('.aqui')).toBe('Usted está aquí · paso 1 de 10'); // ahora toca el viaje 2, cargado
    expect(texto('.renglon-hoja')).toBe('Hoja de ruta · próxima caseta: Plaza Santa Catarina (ejemplo)');
    TestBed.inject(CasetasService).pasar('SAL-2026-00418', 2, 1);
    await estable();
    expect(texto('.renglon-hoja')).toBe('Hoja de ruta · sin casetas pendientes');
  });
});

describe('Sin salida activa (la oficina la cerró o canceló)', () => {
  it('Mi viaje muestra "No tiene un viaje activo" y lleva a Reportes, que conserva lo reportado', async () => {
    await reportarYCerrarSalida();
    const f = TestBed.createComponent(MiViajePage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const tarjeta = el.querySelector('.sin-viaje')!;
    expect(tarjeta.querySelector('h2')!.textContent).toBe('No tiene un viaje activo');
    expect(tarjeta.querySelector('a[href="/reportes"]')!.textContent!.trim()).toBe('Ver mis reportes');
    expect(el.querySelector('app-panel-avance')).toBeNull();
    expect(el.querySelector('app-paso-actual')).toBeNull();
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

  it('sin reportes en el teléfono no ofrece el botón de Reportes', async () => {
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
  it('regreso a Mi viaje; paso actual de 10; origen y destino; datos con cliente y producto; los viajes de la salida', async () => {
    configurar(crearEntorno());
    await entrarComo();
    await TestBed.inject(AsignacionService).cargar();
    const f = TestBed.createComponent(ViajePage);
    f.componentRef.setInput('id', 'ej-via-771');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('app-encabezado h1')!.textContent).toBe('Viaje 2 · Cargado');
    expect(el.querySelector('app-encabezado .subtitulo')!.textContent).toBe('VIA-2026-00771');
    expect(el.querySelector('app-encabezado a.volver')!.getAttribute('href')).toBe('/viaje');
    expect(el.querySelector('.aqui')!.textContent).toBe('Usted está aquí · paso 1 de 10');
    // En el detalle las acciones van en su lugar (no fijas: la pantalla es larga y se desplaza).
    expect(el.querySelector('app-panel-avance')!.classList).not.toContain('fija');
    expect([...el.querySelectorAll('.etiquetas span')].map((s) => s.textContent)).toEqual(['Asignado', 'Cargado', 'Descargado', 'Cerrado']);
    const trayecto = el.querySelector('app-trayecto')!;
    expect(trayecto.textContent).toContain('Apodaca, N.L.');
    expect(trayecto.textContent).toContain('Cita de descarga: 23 nov, 1:00 p. m.');
    const datos = el.querySelector('app-datos-viaje')!;
    expect(datos.textContent).toContain('Aceros del Norte (ejemplo)');
    expect(datos.textContent).toContain('Lámina rolada en caliente');
    expect(datos.textContent).toContain('Toneladas programadas');
    expect(datos.textContent).not.toContain('Cita de carga'); // ya está en el trayecto
    const lista = [...el.querySelectorAll('.viaje-enlace app-etiqueta-estatus')];
    expect(lista).toHaveLength(4);
    for (const e of lista) expect(e.classList).toContain('etiqueta-mediana');
  });
});
