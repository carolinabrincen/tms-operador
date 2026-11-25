/** Arma un TestBed con plataforma falsa: almacenamiento en memoria, IndexedDB falso, reloj y red controlables. */
import { EnvironmentProviders, Provider, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { OperadorApiEjemplo } from '../core/api/ejemplo/operador-api-ejemplo';
import { OPERADOR_API } from '../core/api/operador-api';
import { ALMACEN_EVIDENCIAS, AlmacenEvidenciasIndexedDb } from '../core/evidencias/almacen-evidencias';
import { HERRAMIENTAS_FOTO, HerramientasFoto } from '../shared/utils/foto.util';
import { ALMACEN_LOCAL, AlmacenMemoria, NAVEGADOR, NavegadorMinimo, RELOJ } from '../core/plataforma';
import { ALMACEN_REPORTES, AlmacenReportesIndexedDb } from '../core/reportes/almacen-reportes';
import { AlmacenSesion } from '../core/sesion/almacen-sesion';

export interface EntornoPruebas {
  navegador: NavegadorMinimo & { onLine: boolean };
  almacenLocal: AlmacenMemoria;
  idb: IDBFactory;
  reloj: { ahora: Date };
}

export function crearEntorno(previo?: Partial<EntornoPruebas>): EntornoPruebas {
  return {
    navegador: previo?.navegador ?? { onLine: true },
    almacenLocal: previo?.almacenLocal ?? new AlmacenMemoria(),
    idb: previo?.idb ?? new IDBFactory(),
    reloj: previo?.reloj ?? { ahora: new Date('2026-11-23T16:00:00Z') },
  };
}

export function configurar(e: EntornoPruebas, extra: (Provider | EnvironmentProviders)[] = []): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ALMACEN_LOCAL, useValue: e.almacenLocal },
      { provide: NAVEGADOR, useValue: e.navegador },
      { provide: RELOJ, useValue: () => e.reloj.ahora },
      { provide: ALMACEN_REPORTES, useFactory: () => new AlmacenReportesIndexedDb(e.idb) },
      { provide: ALMACEN_EVIDENCIAS, useFactory: () => new AlmacenEvidenciasIndexedDb(e.idb) },
      { provide: HERRAMIENTAS_FOTO, useValue: HERRAMIENTAS_FOTO_PRUEBA },
      {
        provide: OPERADOR_API,
        useFactory: () => {
          const sesion = inject(AlmacenSesion);
          return new OperadorApiEjemplo({
            operadorId: () => sesion.operadorId(),
            enLinea: () => e.navegador.onLine,
            ahora: () => e.reloj.ahora,
            latenciaMs: 0,
            confirmarHitoTrasMs: 20_000,
            oficinaAvanzaTrasMs: 30_000,
            cierreTrasMs: 30_000,
          });
        },
      },
      ...extra,
    ],
  });
}

/** Entra como operador de ejemplo (sin pasar por la pantalla). */
export async function entrarComo(celular = '8112345678'): Promise<void> {
  const api = TestBed.inject(OPERADOR_API);
  TestBed.inject(AlmacenSesion).guardar(await api.iniciarSesion(celular, '123456'));
}

/** Simula que el teléfono pierde o recupera la señal (actualiza navigator.onLine y dispara el evento). */
export function ponerEnLinea(e: EntornoPruebas, enLinea: boolean): void {
  e.navegador.onLine = enLinea;
  window.dispatchEvent(new Event(enLinea ? 'online' : 'offline'));
}

/** Una "foto" JPEG mínima (firma FF D8 FF): el ejemplo, como el servidor, revisa el contenido. `n` la hace distinta. */
export function fotoJpeg(n = 1, tamano = 64): Blob {
  const bytes = new Uint8Array(tamano);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  bytes[tamano - 1] = n;
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** Sin canvas en las pruebas: "decodificar" da 4032×3024 y "codificar" devuelve un JPEG pequeño. */
export const HERRAMIENTAS_FOTO_PRUEBA: HerramientasFoto = {
  decodificar: async () => ({ ancho: 4032, alto: 3024, fuente: {} as CanvasImageSource }),
  codificar: async () => fotoJpeg(7),
};
