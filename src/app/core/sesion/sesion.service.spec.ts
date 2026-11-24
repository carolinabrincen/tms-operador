import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AsignacionService, claveCopiaAsignacion } from '../viaje/asignacion.service';
import { AlmacenReportesIndexedDb } from '../reportes/almacen-reportes';
import { ColaReportesService } from '../reportes/cola-reportes.service';
import { EntornoPruebas, configurar, crearEntorno } from '../../testing/entorno-pruebas';
import { AlmacenSesion, CLAVE_SESION } from './almacen-sesion';
import { SesionService } from './sesion.service';

describe('SesionService: entrar y salir sin guardar el PIN', () => {
  let e: EntornoPruebas;
  let sesion: SesionService;

  beforeEach(() => {
    e = crearEntorno();
    configurar(e);
    sesion = TestBed.inject(SesionService);
  });

  it('entra con celular (normalizado) y PIN; guarda la sesión sin el PIN', async () => {
    await sesion.entrar('+52 (81) 1234-5678', '975310');
    expect(sesion.sesion()).toMatchObject({ operadorId: 'ej-op-8112345678', celularTerminacion: '5678' });
    const guardado = e.almacenLocal.getItem(CLAVE_SESION)!;
    expect(guardado).not.toContain('975310');
    // Solo el perfil: ni el PIN ni token alguno.
    expect(Object.keys(JSON.parse(guardado)).sort()).toEqual(['celularTerminacion', 'nombre', 'operadorId']);
  });

  it('datos inválidos: rechaza y no deja sesión', async () => {
    await expect(sesion.entrar('81', '123456')).rejects.toMatchObject({ tipo: 'sesion' });
    expect(sesion.sesion()).toBeNull();
    expect(e.almacenLocal.getItem(CLAVE_SESION)).toBeNull();
  });

  it('salir: borra sesión y copia del viaje, va a acceso; los reportes pendientes se quedan en el teléfono', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await sesion.entrar('8112345678', '123456');
    await TestBed.inject(AsignacionService).cargar();
    e.navegador.onLine = false;
    const cola = TestBed.inject(ColaReportesService);
    await cola.registrar({
      tipo: 'estatus',
      viajeId: 'ej-via-770',
      estatus: 'EnTransitoVacio',
      ocurrioEn: '2026-11-23T16:00:00Z',
      ubicacion: null,
      nota: null,
      resumen: 'Viaje 1',
    });
    await sesion.salir();
    expect(sesion.sesion()).toBeNull();
    expect(e.almacenLocal.getItem(CLAVE_SESION)).toBeNull();
    expect(e.almacenLocal.getItem(claveCopiaAsignacion('ej-op-8112345678'))).toBeNull();
    expect(navegar).toHaveBeenCalledWith('/acceso');
    expect(await new AlmacenReportesIndexedDb(e.idb).todos()).toHaveLength(1);
  });
});

describe('AlmacenSesion: solo lo indispensable', () => {
  let e: EntornoPruebas;
  beforeEach(() => {
    e = crearEntorno();
  });

  it('descarta campos de más (p. ej. un PIN que viniera por error)', () => {
    configurar(e);
    TestBed.inject(AlmacenSesion).guardar({ operadorId: 'a', nombre: 'N', celularTerminacion: '1234', token: 't', pin: '000000' } as never);
    expect(JSON.parse(e.almacenLocal.getItem(CLAVE_SESION)!)).toEqual({ operadorId: 'a', nombre: 'N', celularTerminacion: '1234' });
  });

  it('lo guardado dañado o incompleto = sin sesión', () => {
    e.almacenLocal.setItem(CLAVE_SESION, '{no es json');
    configurar(e);
    expect(TestBed.inject(AlmacenSesion).sesion()).toBeNull();
  });

  it('recupera la sesión guardada al abrir la app', () => {
    e.almacenLocal.setItem(CLAVE_SESION, JSON.stringify({ operadorId: 'a', nombre: 'N', celularTerminacion: '1234', token: 't' }));
    configurar(e);
    expect(TestBed.inject(AlmacenSesion).operadorId()).toBe('a');
  });

  it('vencer: limpia y deja aviso; entrar de nuevo quita el aviso', () => {
    configurar(e);
    const a = TestBed.inject(AlmacenSesion);
    a.guardar({ operadorId: 'a', nombre: 'N', celularTerminacion: '1234' });
    a.vencer('Venció');
    expect([a.sesion(), a.aviso()]).toEqual([null, 'Venció']);
    a.guardar({ operadorId: 'a', nombre: 'N', celularTerminacion: '1234' });
    expect(a.aviso()).toBeNull();
  });
});
