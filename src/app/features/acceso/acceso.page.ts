import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OPERADOR_API, comoErrorApi } from '../../core/api/operador-api';
import { MARCA } from '../../core/config/marca';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { AlmacenSesion } from '../../core/sesion/almacen-sesion';
import { SesionService } from '../../core/sesion/sesion.service';
import { PIN_MAX, mensajeCelular, mensajePin } from '../../shared/utils/acceso.util';

const MENSAJE_ERROR: Record<string, string> = {
  sesion: 'Celular o PIN incorrectos. Revise y vuelva a intentar. Si no tiene PIN, pídalo a la oficina.',
  'sin-conexion': 'Sin conexión. Para entrar necesita señal de internet.',
  servidor: 'La oficina no responde en este momento. Intente de nuevo en un rato.',
  rechazado: 'No se pudo entrar. Llame a la oficina.',
};

@Component({
  selector: 'app-acceso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './acceso.page.html',
  styles: `
    .acceso-intro {
      font-size: 1.1rem;
    }
    .acceso-ejemplo {
      margin-top: 24px;
      font-size: 0.95rem;
    }
  `,
})
export class AccesoPage {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MensajesService);
  protected readonly marca = MARCA;
  protected readonly aviso = inject(AlmacenSesion).aviso;
  protected readonly esEjemplo = inject(OPERADOR_API).esEjemplo;
  protected readonly PIN_MAX = PIN_MAX;

  protected readonly celular = signal('');
  /** El PIN vive solo en esta señal mientras se escribe; se borra al intentar entrar. */
  protected readonly pin = signal('');
  protected readonly verPin = signal(false);
  protected readonly intentado = signal(false);
  protected readonly entrando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly errorCelular = computed(() => mensajeCelular(this.celular()));
  protected readonly errorPin = computed(() => mensajePin(this.pin()));

  protected escribir(campo: 'celular' | 'pin', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    (campo === 'celular' ? this.celular : this.pin).set(valor);
    this.errorGeneral.set(null);
  }

  protected async entrar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.entrando()) {
      this.mensajes.mostrar('Espere, estamos revisando sus datos.');
      return;
    }
    this.intentado.set(true);
    if (this.errorCelular() || this.errorPin()) return; // los mensajes aparecen bajo cada campo
    const pin = this.pin();
    this.pin.set(''); // no se conserva el PIN, ni en pantalla
    this.entrando.set(true);
    this.errorGeneral.set(null);
    try {
      await this.sesion.entrar(this.celular(), pin);
      this.intentado.set(false);
      await this.router.navigateByUrl('/viaje');
    } catch (e) {
      this.errorGeneral.set(MENSAJE_ERROR[comoErrorApi(e).tipo]);
    } finally {
      this.entrando.set(false);
    }
  }
}
