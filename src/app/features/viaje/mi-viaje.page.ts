import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Viaje } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { activarRefrescoDelViaje } from '../../core/viaje/refresco-viaje';
import { DatosViajeComponent } from '../../shared/ui/datos-viaje.component';
import { EtiquetaEstatusComponent } from '../../shared/ui/etiqueta-estatus.component';
import { LineaTiempoComponent } from '../../shared/ui/linea-tiempo.component';
import { PanelAvanceComponent } from '../../shared/ui/panel-avance.component';
import { SugerenciaAcuseComponent } from '../../shared/ui/sugerencia-acuse.component';
import { Guia, guia, marcaDeGuia, origenDestino, viajeActivo, viajeQueToca, viajesEnOrden } from '../../shared/utils/estatus-viaje.util';
import { lineaDeTiempo } from '../../shared/utils/linea-tiempo.util';
import { cuandoNegocio } from '../../shared/utils/zona-negocio.util';

@Component({
  selector: 'app-mi-viaje',
  imports: [RouterLink, PanelAvanceComponent, DatosViajeComponent, LineaTiempoComponent, EtiquetaEstatusComponent, SugerenciaAcuseComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mi-viaje.page.html',
  styles: `
    .ahora-etiqueta {
      font-size: 0.95rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0;
    }
    .viaje-enlace {
      display: block;
      color: inherit;
      text-decoration: none;
    }
    .ver-hoja-ruta {
      margin-bottom: 16px;
    }
    .actualizado {
      margin-top: 8px;
      text-align: center;
    }
  `,
})
export class MiViajePage implements OnInit {
  private readonly asignacionSrv = inject(AsignacionService);
  private readonly cola = inject(ColaReportesService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);

  protected readonly ruta = origenDestino;
  protected readonly cuando = (iso: string | null) => cuandoNegocio(iso);

  protected readonly estado = this.asignacionSrv.estado;
  protected readonly error = this.asignacionSrv.error;
  protected readonly asignacion = this.asignacionSrv.asignacion;
  protected readonly actualizadaEn = this.asignacionSrv.actualizadaEn;
  protected readonly salida = computed(() => this.asignacion()?.salida ?? null);
  protected readonly viajes = computed(() => viajesEnOrden(this.salida()));
  protected readonly activo = computed(() => viajeActivo(this.salida(), this.cola.reportes()));
  protected readonly toca = computed(() => viajeQueToca(this.salida(), this.cola.reportes()));
  /** Sin salida activa (la oficina la cerró o canceló) los reportes de antes siguen en "Mis reportes". */
  protected readonly hayReportes = computed(() => this.cola.reportes().length > 0);
  protected readonly linea = computed(() => {
    const v = this.activo();
    return v ? lineaDeTiempo(v, this.cola.reportes()) : [];
  });

  constructor() {
    activarRefrescoDelViaje();
  }

  ngOnInit(): void {
    void this.asignacionSrv.asegurar();
    void this.cola.actualizarEstados();
  }

  /** Estatus efectivo (incluye lo que el operador ya reportó y el servidor aún no refleja). */
  protected guiaDe(v: Viaje): Guia {
    return guia(v, this.cola.reportes());
  }

  protected marcaDe(v: Viaje): string | null {
    return marcaDeGuia(this.guiaDe(v));
  }

  protected async actualizar(): Promise<void> {
    if (this.estado() === 'cargando') {
      this.mensajes.mostrar('Ya se está actualizando, espere un momento.');
      return;
    }
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin conexión: no se puede actualizar ahora. Se muestra lo último guardado.', 'aviso');
      return;
    }
    await Promise.all([this.asignacionSrv.cargar(), this.cola.actualizarEstados()]);
    if (this.estado() === 'listo' && !this.asignacionSrv.desdeCopia()) this.mensajes.mostrar('Viaje actualizado.', 'exito', 2500);
  }
}
