import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { activarRefrescoDelViaje } from '../../core/viaje/refresco-viaje';
import { DatosViajeComponent } from '../../shared/ui/datos-viaje.component';
import { LineaTiempoComponent } from '../../shared/ui/linea-tiempo.component';
import { PanelAvanceComponent } from '../../shared/ui/panel-avance.component';
import { origenDestino, viajeQueToca } from '../../shared/utils/estatus-viaje.util';
import { lineaDeTiempo } from '../../shared/utils/linea-tiempo.util';

/** Detalle de un viaje de la salida: pasos, incidencias, datos y línea de tiempo. Ruta /viaje/:id. */
@Component({
  selector: 'app-viaje',
  imports: [RouterLink, PanelAvanceComponent, DatosViajeComponent, LineaTiempoComponent],
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
