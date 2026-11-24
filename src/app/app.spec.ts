import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { MARCA } from './core/config/marca';
import { MensajesService } from './core/mensajes/mensajes.service';
import { SesionService } from './core/sesion/sesion.service';
import { configurar, crearEntorno, entrarComo, ponerEnLinea } from './testing/entorno-pruebas';

describe('App (armazón)', () => {
  it('muestra el nombre de la marca y el aviso fijo "Datos de ejemplo"; sin sesión no hay menú', async () => {
    configurar(crearEntorno());
    const f = TestBed.createComponent(App);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.cabecera-nombre')?.textContent).toContain(MARCA.nombre);
    expect(el.querySelector('.aviso-ejemplo')?.textContent?.trim()).toBe('Datos de ejemplo');
    // Va en la barra superior, junto al título: no tapa contenido.
    expect(el.querySelector('.cabecera .cabecera-titulo .aviso-ejemplo')).not.toBeNull();
    expect(el.querySelector('nav.menu')).toBeNull();
  });

  it('con sesión: menú con Evidencias y Gastos marcados "Próximamente" que avisan al tocarlos', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const f = TestBed.createComponent(App);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const pronto = [...el.querySelectorAll<HTMLButtonElement>('.menu-pronto')];
    expect(pronto.map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Evidencias Próximamente', 'Gastos Próximamente']);
    pronto[0].click();
    expect(TestBed.inject(MensajesService).mensaje()?.texto).toBe('Evidencias: próximamente. Esta función todavía no está disponible.');
  });

  it('indicador visible de "sin conexión"', async () => {
    const e = crearEntorno();
    configurar(e);
    await entrarComo();
    const f = TestBed.createComponent(App);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.estado-sin-conexion')).toBeNull();
    ponerEnLinea(e, false);
    await f.whenStable();
    expect(el.querySelector('.estado-sin-conexion')?.textContent).toContain('Sin conexión.');
  });

  it('salir: mientras se avisa al servidor, el botón dice "Saliendo…" y no se puede tocar otra vez', async () => {
    configurar(crearEntorno());
    await entrarComo();
    let terminar!: () => void;
    const salir = vi.spyOn(TestBed.inject(SesionService), 'salir').mockImplementation(() => new Promise<void>((r) => (terminar = r)));
    const f = TestBed.createComponent(App);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.cabecera-salir')!.click();
    await f.whenStable();
    [...el.querySelectorAll<HTMLButtonElement>('.hoja button')].find((b) => b.textContent!.trim() === 'Sí, salir')!.click();
    await f.whenStable();
    const boton = el.querySelector<HTMLButtonElement>('.cabecera-salir')!;
    expect(boton.textContent!.trim()).toBe('Saliendo…');
    expect(boton.disabled).toBe(true);
    terminar();
    await vi.waitFor(() => expect(boton.textContent!.trim()).toBe('Salir'));
    expect(salir).toHaveBeenCalledTimes(1);
  });
});
