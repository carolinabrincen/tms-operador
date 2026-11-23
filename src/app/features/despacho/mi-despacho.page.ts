import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MovimientoVacio, Tramo } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { AsignacionService } from '../../core/despacho/asignacion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import {
  ETIQUETA_AVANCE,
  avancesDeTramo,
  estaTerminado,
  objetivoDeMovimiento,
  objetivoDeTramo,
  origenDestino,
  reportesDelObjetivo,
  siguienteAvance,
  tramoQueToca,
  AVANCES_VACIO,
} from '../../shared/utils/avances.util';
import { cuandoNegocio, fechaHoraNegocio, TEXTO_ZONA_NEGOCIO } from '../../shared/utils/zona-negocio.util';

const toneladas = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

@Component({
  selector: 'app-mi-despacho',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mi-despacho.page.html',
  styles: `
    .ahora-etiqueta {
      font-size: 0.95rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0;
    }
    .ahora-siguiente {
      font-size: 1.15rem;
    }
    .actualizado {
      margin-top: 8px;
      text-align: center;
    }
  `,
})
export class MiDespachoPage implements OnInit {
  private readonly asignacionSrv = inject(AsignacionService);
  private readonly cola = inject(ColaReportesService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);

  protected readonly ETIQUETA = ETIQUETA_AVANCE;
  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly fechaHora = fechaHoraNegocio;
  protected readonly cuando = (iso: string | null) => cuandoNegocio(iso);
  protected readonly ruta = origenDestino;

  protected readonly estado = this.asignacionSrv.estado;
  protected readonly error = this.asignacionSrv.error;
  protected readonly asignacion = this.asignacionSrv.asignacion;
  protected readonly actualizadaEn = this.asignacionSrv.actualizadaEn;
  protected readonly despacho = computed(() => this.asignacion()?.despacho ?? null);
  protected readonly movimientos = computed(() => this.asignacion()?.movimientosVacio ?? []);
  protected readonly tramos = computed(() => [...(this.despacho()?.tramos ?? [])].sort((a, b) => a.orden - b.orden));

  protected readonly tramoActual = computed(() => {
    const d = this.despacho();
    return d ? tramoQueToca(d, this.cola.reportes()) : null;
  });

  protected readonly siguienteActual = computed(() => {
    const d = this.despacho();
    const t = this.tramoActual();
    if (!d || !t) return null;
    return siguienteAvance(avancesDeTramo(t), reportesDelObjetivo(this.cola.reportes(), objetivoDeTramo(d, t)));
  });

  ngOnInit(): void {
    void this.asignacionSrv.asegurar();
    void this.cola.actualizarEstados();
  }

  protected tramoTerminado(t: Tramo): boolean {
    const d = this.despacho();
    return !!d && estaTerminado(reportesDelObjetivo(this.cola.reportes(), objetivoDeTramo(d, t)));
  }

  protected movimientoTerminado(m: MovimientoVacio): boolean {
    return estaTerminado(reportesDelObjetivo(this.cola.reportes(), objetivoDeMovimiento(m)));
  }

  protected siguienteMovimiento(m: MovimientoVacio): string | null {
    const s = siguienteAvance(AVANCES_VACIO, reportesDelObjetivo(this.cola.reportes(), objetivoDeMovimiento(m)));
    return s ? ETIQUETA_AVANCE[s] : null;
  }

  protected toneladas(t: number | null): string {
    return t == null ? 'Sin dato' : `${toneladas.format(t)} t`;
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
    await this.asignacionSrv.cargar();
    void this.cola.actualizarEstados();
    if (this.estado() === 'listo' && !this.asignacionSrv.desdeCopia()) this.mensajes.mostrar('Despacho actualizado.', 'exito', 2500);
  }
}
