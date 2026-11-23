import { InjectionToken } from '@angular/core';

/**
 * Accesos a la plataforma detrás de tokens, para probar sin navegador real y para que el mismo código sirva cuando
 * la app se empaquete para tiendas (Capacitor u otro), donde algunas piezas pueden reemplazarse por plugins nativos.
 */

/** Almacenamiento clave-valor pequeño (sesión, banderas). localStorage o, si no se puede usar, memoria. */
export interface AlmacenClaveValor {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export class AlmacenMemoria implements AlmacenClaveValor {
  private readonly datos = new Map<string, string>();
  getItem(clave: string): string | null {
    return this.datos.get(clave) ?? null;
  }
  setItem(clave: string, valor: string): void {
    this.datos.set(clave, valor);
  }
  removeItem(clave: string): void {
    this.datos.delete(clave);
  }
}

function almacenLocalSeguro(): AlmacenClaveValor {
  try {
    const ls = globalThis.localStorage;
    const prueba = '__ct_prueba__';
    ls.setItem(prueba, '1');
    ls.removeItem(prueba);
    return ls;
  } catch {
    // Navegación privada o almacenamiento bloqueado: la app funciona, pero la sesión no sobrevive a recargar.
    return new AlmacenMemoria();
  }
}

export const ALMACEN_LOCAL = new InjectionToken<AlmacenClaveValor>('ALMACEN_LOCAL', {
  providedIn: 'root',
  factory: almacenLocalSeguro,
});

/** Reloj (para pruebas). */
export const RELOJ = new InjectionToken<() => Date>('RELOJ', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/** Lo que se usa de `navigator`. */
export type NavegadorMinimo = Pick<Navigator, 'onLine'> & {
  geolocation?: Pick<Geolocation, 'getCurrentPosition'>;
  permissions?: Pick<Permissions, 'query'>;
  storage?: Partial<Pick<StorageManager, 'persist' | 'persisted'>>;
};

export const NAVEGADOR = new InjectionToken<NavegadorMinimo>('NAVEGADOR', {
  providedIn: 'root',
  factory: () => globalThis.navigator,
});

/** Prefijo de todas las claves de almacenamiento de esta app. */
export const PREFIJO_CLAVES = 'ct-operador.';
