import { TestBed } from '@angular/core/testing';
import { App, AVISO_SEGURIDAD } from './app';
import { MARCA } from './core/config/marca';
import { HojaRutaService } from './core/hoja-ruta/hoja-ruta.service';
import { MensajesService } from './core/mensajes/mensajes.service';
import { ColaReportesService } from './core/reportes/cola-reportes.service';
import { SalidaService } from './core/sesion/salida.service';
import { SesionService } from './core/sesion/sesion.service';
import { AccesoPage } from './features/acceso/acceso.page';
import { CuentaPage } from './features/cuenta/cuenta.page';
import { EncabezadoComponent } from './shared/ui/encabezado.component';
import { estadoSenal, nombreCorto } from './shared/utils/encabezado.util';
import { configurar, crearEntorno, entrarComo, ponerEnLinea } from './testing/entorno-pruebas';

describe('App (armazón): franja de ejemplo, menú y aviso de seguridad', () => {
  it('sin sesión: franja fija "Datos de ejemplo: no son viajes reales"; la entrada con el nombre de la marca; sin menú', async () => {
    configurar(crearEntorno());
    const app = TestBed.createComponent(App);
    await app.whenStable();
    const el = app.nativeElement as HTMLElement;
    expect(el.querySelector('.franja-ejemplo')!.textContent!.trim()).toBe('Datos de ejemplo: no son viajes reales');
    expect(el.classList).toContain('con-ejemplo');
    expect(el.querySelector('nav.menu')).toBeNull();
    const f = TestBed.createComponent(AccesoPage);
    await f.whenStable();
    const acceso = f.nativeElement as HTMLElement;
    expect(acceso.querySelector('app-encabezado h1.titulo')?.textContent).toBe(MARCA.nombre);
    // "Entrar" es el botón principal de la pantalla (72 px).
    expect(acceso.querySelector('button[type=submit]')!.classList).toContain('btn-principal');
  });

  it('con sesión: menú con Mi viaje, Reportes, Fotos y Mi cuenta; el aviso de seguridad una sola vez, sin bloquear', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const f = TestBed.createComponent(App);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const menu = [...el.querySelectorAll<HTMLAnchorElement>('nav.menu a')].map((a) => [a.getAttribute('href'), a.textContent!.trim()]);
    expect(menu).toEqual([
      ['/viaje', 'Mi viaje'],
      ['/reportes', 'Reportes'],
      ['/evidencias', 'Fotos'],
      ['/cuenta', 'Mi cuenta'],
    ]);
    const mensajes = TestBed.inject(MensajesService);
    expect(mensajes.mensaje()?.texto).toBe(AVISO_SEGURIDAD);
    expect(AVISO_SEGURIDAD).toBe('Por su seguridad, use la app con la unidad detenida.');
    // Es un mensaje (no una hoja): no bloquea nada.
    expect(el.querySelector('.velo')).toBeNull();
    mensajes.cerrar(mensajes.mensaje()!.id);
    await f.whenStable();
    expect(mensajes.mensaje()).toBeNull(); // no se repite
  });

  it('el menú marca cuántos reportes faltan por enviar', async () => {
    const e = crearEntorno();
    configurar(e);
    await entrarComo();
    ponerEnLinea(e, false);
    await TestBed.inject(ColaReportesService).registrar({
      tipo: 'incidencia',
      viajeId: 'ej-via-770',
      incidencia: 'DetenidoEnParador',
      ocurrioEn: '2026-11-23T16:00:00Z',
      ubicacion: null,
      nota: null,
      resumen: 'Viaje 1',
    });
    const f = TestBed.createComponent(App);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('a[href="/reportes"] .menu-globo')!.textContent).toBe('Por enviar: 1');
  });
});

describe('Encabezado', () => {
  it('Mi viaje: nombre corto y unidad, estado de la señal y "Tráfico" que llama al teléfono de tráfico de la hoja de ruta', async () => {
    const e = crearEntorno();
    configurar(e);
    await entrarComo();
    await TestBed.inject(HojaRutaService).cargar();
    const f = TestBed.createComponent(EncabezadoComponent);
    f.componentRef.setInput('principal', true);
    f.componentRef.setInput('unidad', 'T-104');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.nombre')!.textContent).toBe('Operador de ejemplo · T-104');
    expect(el.querySelector('.senal')!.textContent!.trim()).toBe('Con señal · todo enviado');
    const trafico = el.querySelector<HTMLAnchorElement>('a.trafico')!;
    expect(trafico.textContent!.trim()).toBe('Tráfico');
    expect(trafico.getAttribute('href')).toBe('tel:8005550199');
    ponerEnLinea(e, false);
    await f.whenStable();
    expect(el.querySelector('.senal')!.classList).toContain('sin-senal');
    expect(el.querySelector('.senal')!.textContent!.trim()).toBe('Sin señal · todo enviado');
  });

  it('sin hoja de ruta guardada no hay a quién llamar: no se muestra el botón', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const f = TestBed.createComponent(EncabezadoComponent);
    f.componentRef.setInput('principal', true);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('a.trafico')).toBeNull();
  });

  it('estado de la cola: con señal, enviando o sin señal con cuántos faltan', () => {
    expect(estadoSenal(true, 0, false)).toEqual({ clase: 'con-senal', texto: 'Con señal · todo enviado' });
    expect(estadoSenal(true, 2, true)).toEqual({ clase: 'enviando', texto: 'Enviando…' });
    expect(estadoSenal(true, 2, false)).toEqual({ clase: 'con-senal', texto: 'Con señal · 2 por enviar' });
    expect(estadoSenal(false, 2, false)).toEqual({ clase: 'sin-senal', texto: 'Sin señal · 2 por enviar' });
  });

  it('nombre corto: primer nombre y primer apellido', () => {
    expect(nombreCorto('Luis Alberto Santos García')).toBe('Luis Santos');
    expect(nombreCorto('Luis Santos García')).toBe('Luis Santos');
    expect(nombreCorto('  Luis   Santos ')).toBe('Luis Santos');
    expect(nombreCorto('María de la Luz')).toBe('María de la Luz');
    expect(nombreCorto('Luis Alberto de la Fuente García')).toBe('Luis de la Fuente');
    expect(nombreCorto('')).toBe('');
  });

  it('secundario: flecha de regreso (50 px) con su nombre para lector de pantalla, título y línea secundaria', async () => {
    configurar(crearEntorno());
    await entrarComo();
    const f = TestBed.createComponent(EncabezadoComponent);
    f.componentRef.setInput('titulo', 'Hoja de ruta');
    f.componentRef.setInput('subtitulo', 'T-104 · al día 26 nov, 11:20 a. m.');
    f.componentRef.setInput('volver', '/viaje');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1.titulo')!.textContent).toBe('Hoja de ruta');
    expect(el.querySelector('.subtitulo')!.textContent).toBe('T-104 · al día 26 nov, 11:20 a. m.');
    const volver = el.querySelector<HTMLAnchorElement>('a.volver')!;
    expect(volver.getAttribute('href')).toBe('/viaje');
    expect(volver.getAttribute('aria-label')).toBe('Regresar a Mi viaje');
  });
});

describe('Mi cuenta: celular, "Gastos, próximamente" y "Salir"', () => {
  async function montar() {
    configurar(crearEntorno());
    await entrarComo();
    const app = TestBed.createComponent(App);
    const cuenta = TestBed.createComponent(CuentaPage);
    await Promise.all([app.whenStable(), cuenta.whenStable()]);
    return { app, cuenta, elApp: app.nativeElement as HTMLElement, el: cuenta.nativeElement as HTMLElement };
  }

  it('muestra nombre y terminación del celular (nunca el PIN); Gastos avisa que es próximamente', async () => {
    const { el } = await montar();
    expect(el.querySelector('.celular')!.textContent).toBe('Termina en 5678');
    expect(el.textContent).not.toMatch(/PIN:|123456/);
    el.querySelector<HTMLButtonElement>('.gastos')!.click();
    expect(TestBed.inject(MensajesService).mensaje()?.texto).toBe('Gastos: próximamente. Esta función todavía no está disponible.');
  });

  it('salir: confirma en una hoja; mientras se avisa al servidor dice "Saliendo…" y no se puede tocar otra vez', async () => {
    const { app, cuenta, elApp, el } = await montar();
    let terminar!: () => void;
    const salir = vi.spyOn(TestBed.inject(SesionService), 'salir').mockImplementation(() => new Promise<void>((r) => (terminar = r)));
    const boton = el.querySelector<HTMLButtonElement>('button.salir')!;
    expect(boton.textContent!.trim()).toBe('Salir');
    boton.click();
    await app.whenStable();
    expect(elApp.querySelector('#titulo-salir')!.textContent).toBe('¿Salir de la aplicación?');
    [...elApp.querySelectorAll<HTMLButtonElement>('.hoja button')].find((b) => b.textContent!.trim() === 'Sí, salir')!.click();
    await Promise.all([app.whenStable(), cuenta.whenStable()]);
    expect(elApp.querySelector('#titulo-salir')).toBeNull();
    expect(boton.textContent!.trim()).toBe('Saliendo…');
    expect(boton.disabled).toBe(true);
    TestBed.inject(SalidaService).pedir(); // tocar otra vez no abre otra confirmación
    await app.whenStable();
    expect(elApp.querySelector('#titulo-salir')).toBeNull();
    terminar();
    await vi.waitFor(async () => {
      await cuenta.whenStable();
      expect(boton.textContent!.trim()).toBe('Salir');
    });
    expect(salir).toHaveBeenCalledTimes(1);
  });
});
