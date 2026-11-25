import { Injectable, inject, signal } from '@angular/core';
import { SesionService } from './sesion.service';

/**
 * "Salir" con confirmación. El botón vive en el encabezado de cada pantalla; la hoja de confirmación, en la app.
 * Mientras se avisa al servidor (unos segundos a lo más) no se puede volver a tocar.
 */
@Injectable({ providedIn: 'root' })
export class SalidaService {
  private readonly sesion = inject(SesionService);

  private readonly confirmandoSig = signal(false);
  private readonly saliendoSig = signal(false);
  readonly confirmando = this.confirmandoSig.asReadonly();
  readonly saliendo = this.saliendoSig.asReadonly();

  pedir(): void {
    if (!this.saliendoSig()) this.confirmandoSig.set(true);
  }

  cancelar(): void {
    this.confirmandoSig.set(false);
  }

  async salir(): Promise<void> {
    this.confirmandoSig.set(false);
    if (this.saliendoSig()) return;
    this.saliendoSig.set(true);
    try {
      await this.sesion.salir();
    } finally {
      this.saliendoSig.set(false);
    }
  }
}
