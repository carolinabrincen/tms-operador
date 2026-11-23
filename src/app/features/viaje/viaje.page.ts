import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { activarRefrescoDelViaje } from '../../core/viaje/refresco-viaje';
import { DatosViajeComponent } from '../../shared/ui/datos-viaje.component';
import { EtiquetaEstatusComponent } from '../../shared/ui/etiqueta-estatus.component';
import { LineaTiempoComponent } from '../../shared/ui/linea-tiempo.component';
import { PanelAvanceComponent } from '../../shared/ui/panel-avance.component';
import { guia, marcaDeGuia, origenDestino, viajeQueToca } from '../../shared/utils/estatus-viaje.util';
import { lineaDeTiempo } from '../../shared/utils/linea-tiempo.util';

/** Detalle de un viaje de la salida: estatus, pasos, incidencias, datos y línea de tiempo. Ruta /viaje/:id. */
@Component({
  selector: 'app-viaje',
  imports: [RouterLink, PanelAvanceComponent, DatosViajeComponent, LineaTiempoComponent, EtiquetaEstatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './viaje.page.html',
})
export class ViajePage implements OnInit {
  /** De la ruta. */
  readonly id = input<string>('');

  private readonly asignacionSrv = inject(AsignacionService);
  private readonly cola = inject(ColaReportesService);

  protected readonly estadoCarga = this.asignacionSrv.estado;
  protected readonly ruta = origenDestino;
  protected readonly viaje = computed(() => this.asignacionSrv.asignacion()?.salida?.viajes.find((v) => v.id === this.id()) ?? null);
  protected readonly toca = computed(() => viajeQueToca(this.asignacionSrv.asignacion()?.salida ?? null, this.cola.reportes()));
  /** Estatus efectivo (incluye lo que el operador ya reportó y el servidor aún no refleja). */
  protected readonly guiaViaje = computed(() => {
    const v = this.viaje();
    return v ? guia(v, this.cola.reportes()) : null;
  });
  protected readonly marca = computed(() => {
    const g = this.guiaViaje();
    return g ? marcaDeGuia(g) : null;
  });
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
}
