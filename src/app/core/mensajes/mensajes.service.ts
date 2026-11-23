import { Injectable, signal } from '@angular/core';

export type TipoMensaje = 'info' | 'exito' | 'aviso' | 'error';

export interface Mensaje {
  id: number;
  texto: string;
  tipo: TipoMensaje;
}

/** Mensaje visible en pantalla (aviso flotante). Uno a la vez: el nuevo reemplaza al anterior. */
@Injectable({ providedIn: 'root' })
export class MensajesService {
  private readonly mensajeSig = signal<Mensaje | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private siguienteId = 1;

  readonly mensaje = this.mensajeSig.asReadonly();

  mostrar(texto: string, tipo: TipoMensaje = 'info', duracionMs = 5000): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    const id = this.siguienteId++;
    this.mensajeSig.set({ id, texto, tipo });
    this.temporizador = setTimeout(() => this.cerrar(id), duracionMs);
  }

  cerrar(id?: number): void {
    if (id != null && this.mensajeSig()?.id !== id) return;
    this.mensajeSig.set(null);
  }
}
