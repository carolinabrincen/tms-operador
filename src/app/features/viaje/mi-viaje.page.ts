import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConexionService } from '../../core/conexion/conexion.service';
import { CasetasService } from '../../core/hoja-ruta/casetas.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { activarRefrescoDelViaje } from '../../core/viaje/refresco-viaje';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';
import { IncidenciasAbiertasComponent } from '../../shared/ui/incidencias-abiertas.component';
import { PanelAvanceComponent } from '../../shared/ui/panel-avance.component';
import { PasoActualComponent } from '../../shared/ui/paso-actual.component';
import { SugerenciaAcuseComponent } from '../../shared/ui/sugerencia-acuse.component';
import { TrayectoComponent } from '../../shared/ui/trayecto.component';
import { estadoCasetas, textoRenglonHoja, tramoDeViaje } from '../../shared/utils/casetas.util';
import { viajeActivo, viajesEnOrden } from '../../shared/utils/estatus-viaje.util';

/**
 * Mi viaje (referencia aprobada, mi-viaje.html): barra con señal y "Tráfico"; el paso actual resaltado; origen y destino
 * con el renglón de la hoja de ruta; incidencias abiertas; y abajo, FIJOS sobre el menú (al alcance del pulgar y
 * siempre a la vista), el botón principal y la fila Incidencia · Foto · Otro paso. Lo demás (datos, fotos, línea de tiempo, otros viajes) está en el detalle del viaje.
 */
@Component({
  selector: 'app-mi-viaje',
  imports: [
    RouterLink,
    EncabezadoComponent,
    PasoActualComponent,
    TrayectoComponent,
    IncidenciasAbiertasComponent,
    SugerenciaAcuseComponent,
    PanelAvanceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mi-viaje.page.html',
  styles: `
    :host {
      display: block;
    }
    /* Deja lugar a las acciones fijas y al menú: lo último de arriba se puede desplazar hasta verse completo. */
    .pagina-viaje {
      padding-bottom: calc(var(--alto-menu-total) + var(--alto-acciones-fijas) + var(--espacio-3) + var(--seguro-abajo));
    }
    app-paso-actual {
      margin-top: 0;
    }
    .tarjeta-ruta {
      display: flex;
      flex-direction: column;
      margin: 12px 0 0;
      padding: 0;
    }
    /* Tocar origen y destino abre el detalle del viaje (datos, fotos, línea de tiempo). */
    .ver-detalle {
      display: flex;
      align-items: center;
      padding-right: 12px;
      color: inherit;
      font-weight: 400;
      text-decoration: none;
    }
    .ver-detalle app-trayecto {
      flex: 1;
      min-width: 0;
    }
    .ver-detalle svg {
      flex: none;
      width: 20px;
      height: 20px;
      fill: none;
      stroke: var(--c-texto-suave);
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .alerta-texto {
      margin: 0 0 var(--espacio-3);
    }
  `,
})
export class MiViajePage implements OnInit {
  private readonly asignacionSrv = inject(AsignacionService);
  private readonly cola = inject(ColaReportesService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);
  private readonly hojaRuta = inject(HojaRutaService);
  private readonly casetas = inject(CasetasService);

  protected readonly estado = this.asignacionSrv.estado;
  protected readonly error = this.asignacionSrv.error;
  protected readonly asignacion = this.asignacionSrv.asignacion;
  protected readonly salida = computed(() => this.asignacion()?.salida ?? null);
  protected readonly viajes = computed(() => viajesEnOrden(this.salida()));
  protected readonly activo = computed(() => viajeActivo(this.salida(), this.cola.reportes()));
  /** Sin salida activa (la oficina la cerró o canceló) los reportes de antes siguen en "Reportes". */
  protected readonly hayReportes = computed(() => this.cola.reportes().length > 0);
  /** "Hoja de ruta · próxima caseta: Fortín" del tramo del viaje activo (de la hoja guardada en el teléfono). */
  protected readonly textoHoja = computed(() => {
    const hoja = this.hojaRuta.hojaRuta();
    const tramo = tramoDeViaje(hoja, this.activo());
    if (!hoja || !tramo) return textoRenglonHoja(null);
    return textoRenglonHoja(estadoCasetas(tramo.ruta?.plazasCobro, this.casetas.pasadas(hoja.folio, tramo.orden)));
  });

  constructor() {
    activarRefrescoDelViaje();
  }

  ngOnInit(): void {
    void this.asignacionSrv.asegurar();
    void this.cola.actualizarEstados();
    void this.hojaRuta.asegurar(); // "Tráfico" y la próxima caseta salen de la hoja guardada
  }

  protected async actualizar(): Promise<void> {
    if (this.estado() === 'cargando') {
      this.mensajes.mostrar('Ya se está actualizando, espere un momento.');
      return;
    }
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin señal: se muestra lo último guardado. Se actualizará solo al volver la señal.', 'aviso');
      return;
    }
    await Promise.all([this.asignacionSrv.cargar(), this.cola.actualizarEstados()]);
    if (this.estado() === 'listo' && !this.asignacionSrv.desdeCopia()) this.mensajes.mostrar('Viaje actualizado.', 'exito', 2500);
  }
}
