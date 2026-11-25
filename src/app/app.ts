import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MARCA } from './core/config/marca';
import { ColaEvidenciasService } from './core/evidencias/cola-evidencias.service';
import { MensajesService } from './core/mensajes/mensajes.service';
import { ColaReportesService } from './core/reportes/cola-reportes.service';
import { AlmacenSesion } from './core/sesion/almacen-sesion';
import { SalidaService } from './core/sesion/salida.service';
import { textoPendientes } from './shared/utils/cola-reportes.util';
import { textoFotosPendientes } from './shared/utils/evidencias.util';

/**
 * Armazón: la pantalla de la ruta, el menú inferior, los mensajes y la confirmación de "Salir". El encabezado azul
 * (con "Salir", "Datos de ejemplo" y los avisos de conexión y pendientes) lo pone cada pantalla con app-encabezado.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  protected readonly sesion = inject(AlmacenSesion).sesion;
  protected readonly cola = inject(ColaReportesService);
  protected readonly fotos = inject(ColaEvidenciasService);
  protected readonly mensajes = inject(MensajesService);
  protected readonly salida = inject(SalidaService);
  protected readonly textoPendientes = textoPendientes;
  protected readonly textoFotosPendientes = textoFotosPendientes;

  constructor() {
    inject(Title).setTitle(MARCA.nombre);
    // Si la sesión termina (salir o vencida), a la pantalla de acceso.
    let habia = !!this.sesion();
    effect(() => {
      const hay = !!this.sesion();
      if (habia && !hay) untracked(() => void this.router.navigateByUrl('/acceso'));
      habia = hay;
    });
  }

  protected proximamente(nombre: string): void {
    this.mensajes.mostrar(`${nombre}: próximamente. Esta función todavía no está disponible.`, 'info');
  }
}
