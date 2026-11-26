import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConexionService } from '../../core/conexion/conexion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';
import { ReporteItemComponent } from '../../shared/ui/reporte-item.component';
import { textoPendientes } from '../../shared/utils/cola-reportes.util';
import { horaNegocio } from '../../shared/utils/zona-negocio.util';

@Component({
  selector: 'app-mis-reportes',
  imports: [RouterLink, EncabezadoComponent, ReporteItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mis-reportes.page.html',
  styles: `
    .leyenda {
      display: grid;
      gap: 10px;
      padding: var(--espacio-4);
      margin: 0 0 var(--espacio-4);
      list-style: none;
      border: 1px solid var(--c-borde);
      border-radius: var(--radio-tarjeta);
      background: var(--c-superficie);
      font-size: var(--texto-chico);
      color: var(--c-texto-suave);
    }
  `,
})
export class MisReportesPage implements OnInit {
  protected readonly cola = inject(ColaReportesService);
  protected readonly enLinea = inject(ConexionService).enLinea;
  private readonly mensajes = inject(MensajesService);
  protected readonly textoPendientes = textoPendientes;
  protected readonly hora = horaNegocio;

  ngOnInit(): void {
    void this.cola.actualizarEstados();
  }

  protected async enviarAhora(): Promise<void> {
    if (!this.cola.pendientes()) {
      this.mensajes.mostrar('No tiene reportes pendientes de enviar.');
      return;
    }
    if (!this.enLinea()) {
      this.mensajes.mostrar('Sin señal: sus reportes quedaron guardados y se enviarán solos al volver la señal.', 'aviso');
      return;
    }
    await this.cola.procesar();
    const faltan = this.cola.pendientes();
    this.mensajes.mostrar(faltan ? `${textoPendientes(faltan)}. Se reintentará solo.` : 'Reportes enviados.', faltan ? 'aviso' : 'exito');
  }

  protected async actualizarEstados(): Promise<void> {
    if (!this.enLinea()) {
      this.mensajes.mostrar('Sin señal: no se puede consultar a la oficina ahora. Intente cuando tenga señal.', 'aviso');
      return;
    }
    await this.cola.actualizarEstados();
    this.mensajes.mostrar('Estados actualizados.', 'exito', 2500);
  }
}
