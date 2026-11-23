import { Injectable, inject } from '@angular/core';
import { PuntoGps } from '../api/operador-api.modelos';
import { ALMACEN_LOCAL, NAVEGADOR, PREFIJO_CLAVES, RELOJ } from '../plataforma';
import {
  ANTIGUEDAD_MAXIMA_GPS_MS,
  ESPERA_GPS_MS,
  EstadoPermisoUbicacion,
  debeExplicar,
  estadoPermisoDe,
  puntoDePosicion,
} from '../../shared/utils/ubicacion.util';

export const CLAVE_UBICACION_EXPLICADA = `${PREFIJO_CLAVES}ubicacion-explicada`;

/**
 * Ubicación SOLO al reportar un avance. No hay seguimiento en segundo plano.
 * Nunca rechaza ni bloquea: sin permiso, sin GPS o si tarda, devuelve null y el reporte se envía sin punto.
 */
@Injectable({ providedIn: 'root' })
export class UbicacionService {
  private readonly navegador = inject(NAVEGADOR);
  private readonly almacen = inject(ALMACEN_LOCAL);
  private readonly reloj = inject(RELOJ);

  async estadoPermiso(): Promise<EstadoPermisoUbicacion> {
    if (!this.navegador?.geolocation) return 'no-disponible';
    try {
      const r = await this.navegador.permissions?.query({ name: 'geolocation' as PermissionName });
      return estadoPermisoDe(r?.state);
    } catch {
      return 'desconocido';
    }
  }

  /** ¿Mostrar la explicación antes de que el teléfono pida el permiso? */
  async necesitaExplicacion(): Promise<boolean> {
    return debeExplicar(await this.estadoPermiso(), this.almacen.getItem(CLAVE_UBICACION_EXPLICADA) === '1');
  }

  marcarExplicada(): void {
    this.almacen.setItem(CLAVE_UBICACION_EXPLICADA, '1');
  }

  /**
   * Punto actual o null. `esperaMs` es el tope total: si el permiso se está pidiendo, conviene dar más tiempo para que
   * el operador lea y conteste.
   */
  obtenerPunto(esperaMs = ESPERA_GPS_MS): Promise<PuntoGps | null> {
    const geo = this.navegador?.geolocation;
    if (!geo) return Promise.resolve(null);
    return new Promise<PuntoGps | null>((resolver) => {
      let listo = false;
      const terminar = (p: PuntoGps | null) => {
        if (listo) return;
        listo = true;
        clearTimeout(tope);
        resolver(p);
      };
      // Tope propio: algunos navegadores no avisan nunca si el operador ignora la pregunta del permiso.
      const tope = setTimeout(() => terminar(null), esperaMs);
      try {
        geo.getCurrentPosition(
          (pos) => terminar(puntoDePosicion(pos, this.reloj())),
          () => terminar(null),
          { enableHighAccuracy: true, timeout: esperaMs, maximumAge: ANTIGUEDAD_MAXIMA_GPS_MS },
        );
      } catch {
        terminar(null);
      }
    });
  }
}
