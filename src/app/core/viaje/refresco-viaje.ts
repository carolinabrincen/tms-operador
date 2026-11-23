import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, untracked } from '@angular/core';
import { ConexionService } from '../conexion/conexion.service';
import { ColaReportesService } from '../reportes/cola-reportes.service';
import { AsignacionService } from './asignacion.service';

/** Cada cuánto se relee el viaje mientras la pantalla está abierta (la oficina puede avanzarlo por su cuenta). */
export const REFRESCO_VIAJE_MS = 30_000;

/**
 * Mantiene al día el viaje en pantalla: lo relee cuando el servidor recibe un reporte o confirma un hito, y cada
 * REFRESCO_VIAJE_MS si hay señal y la app está a la vista. Llamar en el constructor de la pantalla.
 */
export function activarRefrescoDelViaje(): void {
  const asignacion = inject(AsignacionService);
  const cola = inject(ColaReportesService);
  const conexion = inject(ConexionService);
  const documento = inject(DOCUMENT);

  let visto = cola.enviados();
  effect(() => {
    const n = cola.enviados();
    if (n === visto) return;
    visto = n;
    untracked(() => void asignacion.cargar());
  });

  const temporizador = setInterval(() => {
    if (!conexion.enLinea() || documento.visibilityState !== 'visible') return;
    void cola.actualizarEstados();
    void asignacion.cargar();
  }, REFRESCO_VIAJE_MS);
  inject(DestroyRef).onDestroy(() => clearInterval(temporizador));
}
