import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Viaje } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { activarRefrescoDelViaje } from '../../core/viaje/refresco-viaje';
import { DatosViajeComponent } from '../../shared/ui/datos-viaje.component';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';
import { EtiquetaEstatusComponent } from '../../shared/ui/etiqueta-estatus.component';
import { EvidenciasViajeComponent } from '../../shared/ui/evidencias-viaje.component';
import { LineaTiempoComponent } from '../../shared/ui/linea-tiempo.component';
import { PanelAvanceComponent } from '../../shared/ui/panel-avance.component';
import { PasoActualComponent } from '../../shared/ui/paso-actual.component';
import { TrayectoComponent } from '../../shared/ui/trayecto.component';
import { Guia, guia, marcaDeGuia, origenDestino, viajeQueToca, viajesEnOrden } from '../../shared/utils/estatus-viaje.util';
import { lineaDeTiempo } from '../../shared/utils/linea-tiempo.util';
import { cuandoNegocio } from '../../shared/utils/zona-negocio.util';

/**
 * Detalle de un viaje de la salida: paso actual, origen y destino, acciones, datos, fotos (solo cargados), línea de
 * tiempo, los demás viajes de la salida y la unidad. Ruta /viaje/:id.
 */
@Component({
  selector: 'app-viaje',
  imports: [
    RouterLink,
    EncabezadoComponent,
    PasoActualComponent,
    TrayectoComponent,
    PanelAvanceComponent,
    DatosViajeComponent,
    LineaTiempoComponent,
    EtiquetaEstatusComponent,
    EvidenciasViajeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './viaje.page.html',
  styles: `
    .tarjeta-ruta {
      margin: 12px 0;
      padding: 0;
    }
    .viaje-enlace {
      display: block;
      color: inherit;
      text-decoration: none;
      font-weight: 400;
    }
    .viaje-enlace.este {
      border: 1.5px solid var(--c-texto);
    }
    .actualizado {
      margin-top: var(--espacio-2);
      text-align: center;
      font-size: var(--texto-chico);
    }
  `,
})
export class ViajePage implements OnInit {
  /** De la ruta. */
  readonly id = input<string>('');

  private readonly asignacionSrv = inject(AsignacionService);
  private readonly cola = inject(ColaReportesService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);

  protected readonly estadoCarga = this.asignacionSrv.estado;
  protected readonly actualizadaEn = this.asignacionSrv.actualizadaEn;
  protected readonly ruta = origenDestino;
  protected readonly cuando = (iso: string | null) => cuandoNegocio(iso);
  protected readonly salida = computed(() => this.asignacionSrv.asignacion()?.salida ?? null);
  protected readonly viajes = computed(() => viajesEnOrden(this.salida()));
  /** "Viaje 2 · Cargado" en el encabezado. */
  protected readonly titulo = computed(() => {
    const v = this.viaje();
    return v ? `Viaje ${v.orden} · ${v.tipo === 'cargado' ? 'Cargado' : 'Vacío'}` : 'Viaje';
  });
  protected readonly viaje = computed(() => this.salida()?.viajes.find((v) => v.id === this.id()) ?? null);
  /** La asignación llegó sin salida: la oficina la cerró o la canceló. */
  protected readonly sinSalida = computed(() => this.estadoCarga() === 'listo' && this.asignacionSrv.asignacion()?.salida === null);
  protected readonly toca = computed(() => viajeQueToca(this.salida(), this.cola.reportes()));
  protected readonly linea = computed(() => {
    const v = this.viaje();
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
    if (this.estadoCarga() === 'cargando') {
      this.mensajes.mostrar('Ya se está actualizando, espere un momento.');
      return;
    }
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin señal: se muestra lo último guardado. Se actualizará solo al volver la señal.', 'aviso');
      return;
    }
    await Promise.all([this.asignacionSrv.cargar(), this.cola.actualizarEstados()]);
    if (this.estadoCarga() === 'listo' && !this.asignacionSrv.desdeCopia()) this.mensajes.mostrar('Viaje actualizado.', 'exito', 2500);
  }
}
