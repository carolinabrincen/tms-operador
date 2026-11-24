import { Injectable, computed, inject, signal } from '@angular/core';
import { desfaseMs, mensajeReloj } from '../../shared/utils/reloj.util';
import { RELOJ } from '../plataforma';

/** Vigila la hora del teléfono contra la del servidor y da el aviso visible si está mal. */
@Injectable({ providedIn: 'root' })
export class RelojTelefonoService {
  private readonly reloj = inject(RELOJ);
  private readonly desfaseSig = signal<number | null>(null);
  private readonly rechazadaSig = signal(false);

  /** Diferencia teléfono − servidor (ms) según el último acuse. */
  readonly desfase = this.desfaseSig.asReadonly();
  /** Aviso para mostrar, o null si la hora está bien. */
  readonly aviso = computed(() => mensajeReloj(this.desfaseSig(), this.rechazadaSig()));

  /** Hora del servidor recibida ahora mismo (p. ej. `recibidoEn` de un acuse). */
  registrarHoraServidor(iso: string | null | undefined): void {
    const d = desfaseMs(this.reloj(), iso);
    if (d == null) return;
    this.desfaseSig.set(d);
    // Si ya está bien, se quita el aviso de un rechazo anterior.
    if (Math.abs(d) < 60_000) this.rechazadaSig.set(false);
  }

  /** El servidor rechazó un reporte por la hora (DESPACHO_EVENTO_HORA_INVALIDA). */
  registrarHoraRechazada(): void {
    this.rechazadaSig.set(true);
  }
}
