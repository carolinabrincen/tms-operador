import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OPERADOR_API } from './core/api/operador-api';
import { MARCA } from './core/config/marca';
import { ColaEvidenciasService } from './core/evidencias/cola-evidencias.service';
import { MensajesService } from './core/mensajes/mensajes.service';
import { ColaReportesService } from './core/reportes/cola-reportes.service';
import { AlmacenSesion } from './core/sesion/almacen-sesion';
import { SalidaService } from './core/sesion/salida.service';
import { textoPendientes } from './shared/utils/cola-reportes.util';
import { textoFotosPendientes } from './shared/utils/evidencias.util';

/** Se muestra al entrar, una sola vez por sesión, sin bloquear nada. */
export const AVISO_SEGURIDAD = 'Por su seguridad, use la app con la unidad detenida.';

/**
 * Armazón: la franja fija de "Datos de ejemplo", la pantalla de la ruta, el menú inferior (Mi viaje, Reportes, Fotos y
 * Mi cuenta), los mensajes y la confirmación de "Salir" (el botón está en Mi cuenta).
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.con-ejemplo]': 'esEjemplo' },
})
export class App {
  private readonly router = inject(Router);
  protected readonly sesion = inject(AlmacenSesion).sesion;
  protected readonly esEjemplo = inject(OPERADOR_API).esEjemplo;
  protected readonly cola = inject(ColaReportesService);
  protected readonly fotos = inject(ColaEvidenciasService);
  protected readonly mensajes = inject(MensajesService);
  protected readonly salida = inject(SalidaService);
  protected readonly textoPendientes = textoPendientes;
  protected readonly textoFotosPendientes = textoFotosPendientes;

  constructor() {
    inject(Title).setTitle(MARCA.nombre);
    let habia = !!this.sesion();
    let avisado = false;
    effect(() => {
      const hay = !!this.sesion();
      // Si la sesión termina (salir o vencida), a la pantalla de acceso.
      if (habia && !hay) untracked(() => void this.router.navigateByUrl('/acceso'));
      // Al entrar (o al abrir la app con la sesión ya iniciada): el aviso de seguridad, una vez por sesión.
      if (hay && !avisado) {
        avisado = true;
        untracked(() => this.mensajes.mostrar(AVISO_SEGURIDAD, 'info', 6000));
      }
      if (!hay) avisado = false;
      habia = hay;
    });
  }
}
