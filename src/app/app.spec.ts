import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { MARCA } from './core/config/marca';
import { MensajesService } from './core/mensajes/mensajes.service';
import { SalidaService } from './core/sesion/salida.service';
import { SesionService } from './core/sesion/sesion.service';
import { AccesoPage } from './features/acceso/acceso.page';
import { EncabezadoComponent } from './shared/ui/encabezado.component';
import { configurar, crearEntorno, entrarComo, ponerEnLinea } from './testing/entorno-pruebas';

describe('App (armazón) y encabezado', () => {
  it('sin sesión: la entrada lleva el nombre de la marca en el encabezado azul y la píldora "Datos de ejemplo"; sin menú ni "Salir"', async () => {
    configurar(crearEntorno());
    const app = TestBed.createComponent(App);
    await app.whenStable();
    expect((app.nativeElement as HTMLElement).querySelector('nav.menu')).toBeNull();
    const f = TestBed.createComponent(AccesoPage);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('app-encabezado .enc-titulo')?.textContent).toBe(MARCA.nombre);
    // Va dentro del encabezado: no tapa contenido.
    expect(el.querySelector('app-encabezado .enc .aviso-ejemplo')?.textContent?.trim()).toBe('Datos de ejemplo');
    expect(el.querySelector('.enc-salir')).toBeNull();
  });

  it('con sesión: menú con Evidencias (ya disponible) y Gastos marcado "Próximamente", que avisa al tocarlo', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const f = TestBed.createComponent(App);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('nav.menu a[href="/evidencias"]')?.textContent).toContain('Evidencias');
    const pronto = [...el.querySelectorAll<HTMLButtonElement>('.menu-pronto')];
    expect(pronto.map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Gastos Próximamente']);
    pronto[0].click();
    expect(TestBed.inject(MensajesService).mensaje()?.texto).toBe('Gastos: próximamente. Esta función todavía no está disponible.');
  });

  it('encabezado secundario: flecha de regreso con su nombre para lector de pantalla y el título', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const f = TestBed.createComponent(EncabezadoComponent);
    f.componentRef.setInput('titulo', 'Mis reportes');
    f.componentRef.setInput('volver', '/viaje');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1.enc-titulo')!.textContent).toBe('Mis reportes');
    const volver = el.querySelector<HTMLAnchorElement>('a.enc-volver')!;
    expect(volver.getAttribute('href')).toBe('/viaje');
    expect(volver.getAttribute('aria-label')).toBe('Regresar a Mi viaje');
    expect(el.querySelector('.enc-salir')!.textContent!.trim()).toBe('Salir');
  });

  it('indicador visible de "sin conexión" en el encabezado', async () => {
    const e = crearEntorno();
    configurar(e);
    await entrarComo();
    const f = TestBed.createComponent(EncabezadoComponent);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.estado-sin-conexion')).toBeNull();
    ponerEnLinea(e, false);
    await f.whenStable();
    expect(el.querySelector('.estado-sin-conexion')?.textContent).toContain('Sin conexión.');
  });

  it('salir: confirma en una hoja; mientras se avisa al servidor el botón dice "Saliendo…" y no se puede tocar otra vez', async () => {
    configurar(crearEntorno());
    await entrarComo();
    let terminar!: () => void;
    const salir = vi.spyOn(TestBed.inject(SesionService), 'salir').mockImplementation(() => new Promise<void>((r) => (terminar = r)));
    const app = TestBed.createComponent(App);
    const enc = TestBed.createComponent(EncabezadoComponent);
    await Promise.all([app.whenStable(), enc.whenStable()]);
    const elApp = app.nativeElement as HTMLElement;
    const boton = (enc.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.enc-salir')!;
    boton.click();
    await app.whenStable();
    expect(elApp.querySelector('#titulo-salir')!.textContent).toBe('¿Salir de la aplicación?');
    [...elApp.querySelectorAll<HTMLButtonElement>('.hoja button')].find((b) => b.textContent!.trim() === 'Sí, salir')!.click();
    await Promise.all([app.whenStable(), enc.whenStable()]);
    expect(elApp.querySelector('#titulo-salir')).toBeNull();
    expect(boton.textContent!.trim()).toBe('Saliendo…');
    expect(boton.disabled).toBe(true);
    TestBed.inject(SalidaService).pedir(); // tocar otra vez no abre otra confirmación
    await app.whenStable();
    expect(elApp.querySelector('#titulo-salir')).toBeNull();
    terminar();
    await vi.waitFor(async () => {
      await enc.whenStable();
      expect(boton.textContent!.trim()).toBe('Salir');
    });
    expect(salir).toHaveBeenCalledTimes(1);
  });
});
