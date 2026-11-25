import { TestBed } from '@angular/core/testing';
import { EstatusViaje } from '../../core/api/operador-api.modelos';
import { presentacionEstatus } from '../utils/estatus-viaje.util';
import { ESCALA_ETIQUETA, EtiquetaEstatusComponent } from './etiqueta-estatus.component';

async function montar(estatus: EstatusViaje, tamano?: 'encabezado' | 'grande' | 'mediano', marca?: string) {
  const f = TestBed.createComponent(EtiquetaEstatusComponent);
  f.componentRef.setInput('estatus', estatus);
  if (tamano) f.componentRef.setInput('tamano', tamano);
  if (marca) f.componentRef.setInput('marca', marca);
  await f.whenStable();
  return f.nativeElement as HTMLElement;
}

/** "#7a3400" → "rgb(122, 52, 0)" (como lo deja el navegador en style). */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

describe('EtiquetaEstatusComponent: el estatus, grande y con su color', () => {
  it('grande por omisión: al menos 1.4 veces el texto normal', async () => {
    expect(ESCALA_ETIQUETA.grande).toBeGreaterThanOrEqual(1.4);
    const el = await montar('EnTransitoVacio');
    expect(el.classList).toContain('etiqueta-grande');
    expect(el.style.fontSize).toBe(`calc(var(--texto-normal) * ${ESCALA_ETIQUETA.grande})`);
  });

  it('texto y colores salen del util (un solo lugar)', async () => {
    const el = await montar('EnTransitoVacio');
    const p = presentacionEstatus('EnTransitoVacio');
    expect(el.querySelector('.etiqueta-texto')!.textContent).toBe('Estatus: En tránsito (vacío)');
    expect(el.style.backgroundColor).toBe(rgb(p.fondo));
    expect(el.style.color).toBe(rgb(p.tinta));
  });

  it('mediana para la lista de viajes, más chica que la grande', async () => {
    const el = await montar('Cerrado', 'mediano');
    expect(el.classList).toContain('etiqueta-mediana');
    expect(ESCALA_ETIQUETA.mediano).toBeLessThan(ESCALA_ETIQUETA.grande);
    expect(el.style.fontSize).toBe(`calc(var(--texto-normal) * ${ESCALA_ETIQUETA.mediano})`);
  });

  it('con aclaración (p. ej. hito por confirmar)', async () => {
    const el = await montar('Documentado', 'grande', 'Pendiente de confirmar por oficina');
    expect(el.querySelector('.etiqueta-marca')!.textContent).toBe('Pendiente de confirmar por oficina');
  });

  it('en el encabezado azul: blanco y sin fondo propio (el azul es el fondo), 30 px', async () => {
    const el = await montar('EnTransito', 'encabezado', 'Pendiente de confirmar por oficina');
    expect(el.classList).toContain('etiqueta-encabezado');
    expect(el.style.backgroundColor).toBe('');
    expect(el.style.color).toBe('');
    expect(ESCALA_ETIQUETA.encabezado * 16).toBe(30);
    expect(el.querySelector('.etiqueta-marca')!.textContent).toBe('Pendiente de confirmar por oficina');
  });
});
