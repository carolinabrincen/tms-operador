import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NAVEGADOR } from '../plataforma';

/**
 * ¿Hay conexión? Escucha los eventos online/offline del navegador. Ojo: "en línea" no garantiza que el servidor
 * responda (señal débil); por eso la cola además reintenta con espera creciente.
 */
@Injectable({ providedIn: 'root' })
export class ConexionService {
  private readonly navegador = inject(NAVEGADOR);
  private readonly ventana = inject(DOCUMENT).defaultView;
  private readonly documento = inject(DOCUMENT);
  private readonly oyentes = new Set<() => void>();
  private readonly enLineaSig = signal(this.navegador?.onLine ?? true);

  readonly enLinea = this.enLineaSig.asReadonly();

  constructor() {
    const alConectar = () => {
      this.enLineaSig.set(true);
      this.avisar();
    };
    const alDesconectar = () => this.enLineaSig.set(false);
    // Al volver a la app (estaba en segundo plano) se reintenta: el teléfono pudo recuperar señal sin avisar.
    const alVolver = () => {
      if (this.documento.visibilityState === 'visible' && this.enLineaSig()) this.avisar();
    };
    this.ventana?.addEventListener('online', alConectar);
    this.ventana?.addEventListener('offline', alDesconectar);
    this.documento.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => {
      this.ventana?.removeEventListener('online', alConectar);
      this.ventana?.removeEventListener('offline', alDesconectar);
      this.documento.removeEventListener('visibilitychange', alVolver);
    });
  }

  /** Registra qué hacer al recuperar la conexión (o al volver a la app con conexión). Devuelve cómo darse de baja. */
  alRecuperar(accion: () => void): () => void {
    this.oyentes.add(accion);
    return () => this.oyentes.delete(accion);
  }

  private avisar(): void {
    for (const accion of this.oyentes) accion();
  }
}
