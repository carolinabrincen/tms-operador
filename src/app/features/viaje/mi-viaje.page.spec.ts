import { TestBed } from '@angular/core/testing';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { configurar, crearEntorno, entrarComo } from '../../testing/entorno-pruebas';
import { MiViajePage } from './mi-viaje.page';

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
