import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConexionService } from '../../core/conexion/conexion.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { textoMotivo } from '../../shared/utils/estatus-viaje.util';
import { avisoOtraSalida, detalleLugar, fechaSinHora, ligaTelefono, textoKm, textoParada, textoTiempo, textoToneladas } from '../../shared/utils/hoja-ruta.util';
import { TEXTO_ZONA_NEGOCIO, fechaHoraNegocio } from '../../shared/utils/zona-negocio.util';

/** Hoja de ruta de la salida activa (contrato M2, sección 1). Sin importes. Se puede ver sin señal. Ruta /hoja-ruta. */
@Component({
  selector: 'app-hoja-ruta',
  imports: [RouterLink, EncabezadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hoja-ruta.page.html',
  styles: `
    .telefonos {
      display: grid;
      gap: 8px;
    }
    .tramo h3 {
      margin: 0 0 var(--espacio-2);
    }
    .tramo h4 {
      margin: var(--espacio-4) 0 var(--espacio-1);
      font-size: var(--texto-chico);
      color: var(--c-texto-suave);
    }
    .lugar {
      padding: var(--espacio-2) 0;
      border-top: 1px solid var(--c-borde);
    }
    .lugar span {
      font-size: var(--texto-chico);
    }
    .abrir-mapa {
      margin-top: var(--espacio-4);
    }
    .generada {
      font-size: var(--texto-chico);
    }
    .lugar {
      margin: 0 0 8px;
    }
    .lugar strong {
      display: block;
    }
    .lista-simple {
      margin: 4px 0 0;
      padding-left: 20px;
    }
    .lista-simple li {
      margin-bottom: 6px;
    }
    .actualizado {
      margin-top: 8px;
      text-align: center;
    }
  `,
})
export class HojaRutaPage implements OnInit {
  private readonly servicio = inject(HojaRutaService);
  private readonly asignacion = inject(AsignacionService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);

  protected readonly hoja = this.servicio.hojaRuta;
  protected readonly estado = this.servicio.estado;
  protected readonly error = this.servicio.error;
  protected readonly desdeCopia = this.servicio.desdeCopia;
  protected readonly guardadaEn = this.servicio.guardadaEn;
  protected readonly avisoSalida = computed(() => avisoOtraSalida(this.hoja()?.folio, this.asignacion.asignacion()?.salida?.folio));

  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly fechaHora = (iso: string | null) => fechaHoraNegocio(iso);
  protected readonly fecha = fechaSinHora;
  protected readonly tel = ligaTelefono;
  protected readonly km = textoKm;
  protected readonly toneladas = textoToneladas;
  protected readonly tiempo = textoTiempo;
  protected readonly parada = textoParada;
  protected readonly motivo = textoMotivo;
  protected readonly detalle = detalleLugar;

  ngOnInit(): void {
    void this.servicio.asegurar();
  }

  protected async actualizar(): Promise<void> {
    if (this.estado() === 'cargando') {
      this.mensajes.mostrar('Ya se está actualizando, espere un momento.');
      return;
    }
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin conexión: se muestra la hoja guardada. Se actualizará sola al volver la señal.', 'aviso');
      return;
    }
    await this.servicio.cargar();
    if (this.estado() === 'listo' && !this.desdeCopia()) this.mensajes.mostrar('Hoja de ruta actualizada.', 'exito', 2500);
  }
}
