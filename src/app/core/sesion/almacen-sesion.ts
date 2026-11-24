import { Injectable, computed, inject, signal } from '@angular/core';
import { SesionOperador } from '../api/operador-api.modelos';
import { ALMACEN_LOCAL, PREFIJO_CLAVES } from '../plataforma';

export const CLAVE_SESION = `${PREFIJO_CLAVES}sesion`;
export const MENSAJE_SESION_VENCIDA = 'Su sesión terminó. Entre de nuevo; sus reportes pendientes se enviarán solos.';

/**
 * Sesión del operador en el teléfono. Guarda SOLO: id, nombre, terminación del celular y token.
 * El PIN nunca pasa por aquí. (La estrategia definitiva del token se decidirá con el contrato de la API.)
 */
@Injectable({ providedIn: 'root' })
export class AlmacenSesion {
  private readonly almacen = inject(ALMACEN_LOCAL);
  private readonly sesionSig = signal<SesionOperador | null>(this.leer());
  /** Mensaje para la pantalla de acceso cuando la sesión terminó sola (p. ej. venció). */
  private readonly avisoSig = signal<string | null>(null);

  readonly sesion = this.sesionSig.asReadonly();
  readonly operadorId = computed(() => this.sesionSig()?.operadorId ?? null);
  readonly aviso = this.avisoSig.asReadonly();

  guardar(s: SesionOperador): void {
    // Copia explícita campo por campo: nada más (ni el PIN ni lo que agregue el servidor) llega al almacenamiento.
    const limpia: SesionOperador = {
      operadorId: s.operadorId,
      nombre: s.nombre,
      celularTerminacion: s.celularTerminacion,
    };
    this.almacen.setItem(CLAVE_SESION, JSON.stringify(limpia));
    this.avisoSig.set(null);
    this.sesionSig.set(limpia);
  }

  limpiar(): void {
    this.almacen.removeItem(CLAVE_SESION);
    this.sesionSig.set(null);
  }

  /** La sesión terminó sin que el operador la cerrara: se limpia y se deja un aviso para la pantalla de acceso. */
  vencer(aviso: string): void {
    this.limpiar();
    this.avisoSig.set(aviso);
  }

  private leer(): SesionOperador | null {
    try {
      const s = JSON.parse(this.almacen.getItem(CLAVE_SESION) ?? 'null') as Partial<SesionOperador> | null;
      // Un perfil del paso 1 o 2 traía también un token: se ignora (ya no se guarda aquí).
      if (!s || typeof s.operadorId !== 'string' || !s.operadorId) return null;
      return {
        operadorId: s.operadorId,
        nombre: typeof s.nombre === 'string' ? s.nombre : '',
        celularTerminacion: typeof s.celularTerminacion === 'string' ? s.celularTerminacion : '',
      };
    } catch {
      return null;
    }
  }
}
