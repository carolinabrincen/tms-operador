import { TestBed } from '@angular/core/testing';
import { OperadorApiEjemplo } from '../../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../../core/api/operador-api';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { MiViajePage } from '../../features/viaje/mi-viaje.page';
import { EntornoPruebas, configurar, crearEntorno, entrarComo, ponerEnLinea } from '../../testing/entorno-pruebas';

/** Mi viaje con la incidencia abierta que registró la oficina en el viaje 1 (datos de ejemplo). */
async function montar(e: EntornoPruebas = crearEntorno()) {
  configurar(e);
  await entrarComo();
  await TestBed.inject(AsignacionService).cargar();
  const f = TestBed.createComponent(MiViajePage);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const boton = (texto: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === texto)!;
  const estable = async () => {
    await f.whenStable();
  };
  return { f, el, boton, estable, e };
}

describe('Mi viaje: incidencias abiertas y "Ya continué"', () => {
  it('tarjeta ámbar ARRIBA de "Siguiente paso": tipo, "desde las 09:20" (hora del negocio), nota y botón grande "Ya continué"', async () => {
    const { el } = await montar();
    const main = el.querySelector('main')!;
    const tarjeta = main.querySelector('.tarjeta-incidencia')!;
    expect(tarjeta.querySelector('.tipo')!.textContent).toBe('Retén o inspección');
    expect(tarjeta.querySelector('.desde')!.textContent).toBe('desde las 09:20');
    expect(tarjeta.querySelector('.nota')!.textContent).toBe('“Revisión de documentos a la salida del patio”');
    const boton = tarjeta.querySelector('.ya-continue')!;
    expect(boton.textContent!.trim()).toBe('Ya continué');
    expect(boton.classList).toContain('btn-grande');
    // Orden: la incidencia va antes del panel "Siguiente paso".
    const panel = main.querySelector('app-panel-avance')!;
    expect(tarjeta.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('"Ya continué" pide confirmar con nota opcional; en cola dice "Pendiente de enviar" sin repetir el botón; con señal, desaparece', async () => {
    const { el, boton, estable, e } = await montar();
    ponerEnLinea(e, false);
    boton('Ya continué').click();
    await vi.waitFor(async () => {
      await estable();
      expect(el.querySelector('#titulo-ya-continue')?.textContent).toBe('¿Ya continuó?');
    });
    const nota = el.querySelector<HTMLTextAreaElement>('#nota-ya-continue')!;
    nota.value = 'Ya pasé la revisión';
    nota.dispatchEvent(new Event('input'));
    await estable();
    boton('Sí, ya continué').click();
    const cola = TestBed.inject(ColaReportesService);
    await vi.waitFor(() => expect(cola.pendientes()).toBe(1));
    await estable();
    const tarjeta = el.querySelector('.tarjeta-incidencia')!;
    expect(tarjeta.querySelector('.chip')!.textContent).toBe('Pendiente de enviar');
    expect(tarjeta.querySelector('.ya-continue')).toBeNull();
    expect(cola.reportes()[0].reporte).toMatchObject({ tipo: 'termino', incidenciaId: 'ej-inc-oficina-1', nota: 'Ya pasé la revisión' });

    ponerEnLinea(e, true);
    await vi.waitFor(async () => {
      await estable();
      expect(el.querySelector('.tarjeta-incidencia')).toBeNull();
    });
    // Y sigue sin tarjeta cuando se relee la asignación (el servidor ya no la da por abierta).
    await TestBed.inject(AsignacionService).cargar();
    await estable();
    expect(el.querySelector('.tarjeta-incidencia')).toBeNull();
  });

  it('no bloquea el siguiente paso: al reportarlo, el servidor termina la incidencia y al refrescar la tarjeta desaparece', async () => {
    const { el, estable } = await montar();
    expect(el.querySelector('.tarjeta-incidencia')).not.toBeNull();
    const cola = TestBed.inject(ColaReportesService);
    await cola.registrar({ tipo: 'estatus', viajeId: 'ej-via-770', estatus: 'EnTransitoVacio', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, resumen: 'Viaje 1' });
    await vi.waitFor(async () => {
      await estable();
      expect(el.querySelector('.tarjeta-incidencia')).toBeNull();
    });
    expect((await TestBed.inject(OPERADOR_API).obtenerAsignacion()).salida!.incidenciasAbiertas).toEqual([]);
  });

  it('al reportar una incidencia desde la app, su tarjeta aparece de inmediato (aun sin señal)', async () => {
    const { el, estable, e } = await montar();
    ponerEnLinea(e, false);
    await TestBed.inject(ColaReportesService).registrar({
      tipo: 'incidencia',
      viajeId: 'ej-via-770',
      incidencia: 'IncidenciaMecanica',
      ocurrioEn: '2026-11-23T16:00:00Z',
      ubicacion: null,
      nota: 'Se calentó el motor',
      resumen: 'Viaje 1',
    });
    await estable();
    const tarjetas = [...el.querySelectorAll('.tarjeta-incidencia')];
    expect(tarjetas.map((t) => t.querySelector('.tipo')!.textContent)).toEqual(['Retén o inspección', 'Falla mecánica']);
    expect(tarjetas[1].querySelector('.chip')!.textContent).toBe('Pendiente de enviar');
    expect(tarjetas[1].querySelector('.ya-continue')).toBeNull();
    // Con señal llega a la oficina; la asignación la trae ya abierta y con su botón.
    ponerEnLinea(e, true);
    await vi.waitFor(async () => {
      await estable();
      const t = [...el.querySelectorAll('.tarjeta-incidencia')];
      expect(t).toHaveLength(2);
      expect(t[1].querySelector('.ya-continue')).not.toBeNull();
    });
  });

  it('también las que registró la oficina; la que terminó la oficina ya no aparece al releer', async () => {
    const { el, estable } = await montar();
    const api = TestBed.inject(OPERADOR_API) as OperadorApiEjemplo;
    api.terminarIncidenciaPorOficina('ej-op-8112345678', 'ej-inc-oficina-1');
    await TestBed.inject(AsignacionService).cargar();
    await estable();
    expect(el.querySelector('.tarjeta-incidencia')).toBeNull();
  });
});
