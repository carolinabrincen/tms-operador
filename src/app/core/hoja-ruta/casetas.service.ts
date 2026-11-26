import { Injectable, inject, signal } from '@angular/core';
import { ALMACEN_LOCAL, PREFIJO_CLAVES } from '../plataforma';
import { AlmacenSesion } from '../sesion/almacen-sesion';

export const claveCasetas = (operadorId: string) => `${PREFIJO_CLAVES}casetas.v1.${operadorId}`;

/** Lo guardado: de qué salida es y cuántas casetas lleva pasadas en cada tramo (por su orden). */
interface CasetasGuardadas {
  folio: string;
  pasadas: Record<string, number>;
}

function esValido(x: unknown): x is CasetasGuardadas {
  const c = x as CasetasGuardadas | null;
  return !!c && typeof c.folio === 'string' && !!c.pasadas && typeof c.pasadas === 'object';
}

/**
 * "Ya la pasé": cuántas casetas lleva pasadas el operador en cada tramo, recordado en el teléfono POR SALIDA (si cambia
 * la salida, se empieza de cero). Solo nombres y conteos: nunca importes.
 */
@Injectable({ providedIn: 'root' })
export class CasetasService {
  private readonly almacen = inject(ALMACEN_LOCAL);
  private readonly sesion = inject(AlmacenSesion);
  /** Sube con cada cambio, para que las pantallas recalculen. */
  private readonly versionSig = signal(0);
  readonly version = this.versionSig.asReadonly();

  /** Cuántas lleva pasadas en ese tramo de esa salida. */
  pasadas(folioSalida: string, tramo: number): number {
    this.versionSig(); // dependencia para las pantallas
    const g = this.leer();
    return g && g.folio === folioSalida ? (g.pasadas[String(tramo)] ?? 0) : 0;
  }

  /** "Ya la pasé": avanza a la siguiente (sin pasar del total). */
  pasar(folioSalida: string, tramo: number, total: number): void {
    this.poner(folioSalida, tramo, Math.min(this.pasadas(folioSalida, tramo) + 1, total));
  }

  /** Regresa una (por si tocó "Ya la pasé" por error). */
  regresar(folioSalida: string, tramo: number): void {
    this.poner(folioSalida, tramo, Math.max(this.pasadas(folioSalida, tramo) - 1, 0));
  }

  private poner(folioSalida: string, tramo: number, n: number): void {
    const id = this.sesion.operadorId();
    if (!id) return;
    const g = this.leer();
    // Otra salida: lo de la anterior ya no sirve.
    const base: CasetasGuardadas = g && g.folio === folioSalida ? g : { folio: folioSalida, pasadas: {} };
    base.pasadas[String(tramo)] = n;
    try {
      this.almacen.setItem(claveCasetas(id), JSON.stringify(base));
    } catch {
      // Sin espacio: se pierde el recordatorio, la hoja sigue funcionando.
    }
    this.versionSig.update((v) => v + 1);
  }

  private leer(): CasetasGuardadas | null {
    const id = this.sesion.operadorId();
    if (!id) return null;
    try {
      const x: unknown = JSON.parse(this.almacen.getItem(claveCasetas(id)) ?? 'null');
      return esValido(x) ? x : null;
    } catch {
      return null;
    }
  }
}
