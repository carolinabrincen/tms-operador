import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OPERADOR_API } from './core/api/operador-api';
import { MARCA } from './core/config/marca';
import { ConexionService } from './core/conexion/conexion.service';
import { MensajesService } from './core/mensajes/mensajes.service';
import { RelojTelefonoService } from './core/reloj/reloj-telefono.service';
import { ColaReportesService } from './core/reportes/cola-reportes.service';
import { AlmacenSesion } from './core/sesion/almacen-sesion';
import { SesionService } from './core/sesion/sesion.service';
import { textoPendientes } from './shared/utils/cola-reportes.util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly sesionService = inject(SesionService);
  protected readonly marca = MARCA;
  protected readonly sesion = inject(AlmacenSesion).sesion;
  protected readonly enLinea = inject(ConexionService).enLinea;
  protected readonly cola = inject(ColaReportesService);
  protected readonly mensajes = inject(MensajesService);
  protected readonly esEjemplo = inject(OPERADOR_API).esEjemplo;
  protected readonly confirmandoSalida = signal(false);
  /** Hora del teléfono mal puesta: el servidor rechaza reportes con más de 10 minutos en el futuro. */
  protected readonly avisoReloj = inject(RelojTelefonoService).aviso;
  protected readonly textoPendientes = textoPendientes;

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

  protected async salir(): Promise<void> {
    this.confirmandoSalida.set(false);
    await this.sesionService.salir();
  }
}
