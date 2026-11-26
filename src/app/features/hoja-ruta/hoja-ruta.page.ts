import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TramoHoja } from '../../core/api/operador-api-m2.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { CasetasService } from '../../core/hoja-ruta/casetas.service';
import { HojaRutaService } from '../../core/hoja-ruta/hoja-ruta.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { RELOJ } from '../../core/plataforma';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';
import { EstadoCasetas, estadoCasetas } from '../../shared/utils/casetas.util';
import { textoMotivo } from '../../shared/utils/estatus-viaje.util';
import { avisoOtraSalida, detalleLugar, fechaSinHora, ligaTelefono, textoKm, textoParada, textoTiempo, textoToneladas } from '../../shared/utils/hoja-ruta.util';
import { TEXTO_ZONA_NEGOCIO, fechaHoraNegocio } from '../../shared/utils/zona-negocio.util';

/**
 * Hoja de ruta de la salida activa (contrato M2, sección 1; referencia aprobada, hoja-ruta.html): teléfonos con
 * "Llamar"; por tramo, origen y destino, la parada autorizada y SOLO la próxima caseta con "Ya la pasé" (se recuerda en
 * el teléfono por salida; "Ver todas" muestra la lista); "Abrir en mapa". Nunca importes. Se puede ver sin señal.
 */
@Component({
  selector: 'app-hoja-ruta',
  imports: [RouterLink, EncabezadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hoja-ruta.page.html',
  styles: `
    .telefonos {
      padding: 0;
    }
    .telefono {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 8px 8px 16px;
    }
    .telefono + .telefono {
      border-top: 1px solid var(--c-borde);
    }
    .telefono-datos {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .numero {
      font-size: var(--texto-telefono);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .llamar {
      flex: none;
    }
    .llamar svg {
      width: 16px;
      height: 16px;
    }
    .sin-telefonos {
      margin: 0;
      padding: 16px;
    }
    .tramo {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .tramo-cabeza {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 4px 10px;
    }
    .tramo-titulo {
      margin: 0;
      font-size: var(--texto-chico);
    }
    .distancia {
      font-size: var(--texto-chico);
      font-variant-numeric: tabular-nums;
    }
    .sin-margen {
      margin: 0;
    }
    .recorrido {
      display: flex;
      gap: 12px;
    }
    .guia {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 5px;
    }
    .inicio {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      border: 2px solid var(--c-texto);
    }
    .union {
      flex: 1;
      width: 1.5px;
      margin: 3px 0;
      background: var(--c-borde);
    }
    .fin {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--c-texto);
    }
    .lugares {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .lugar {
      display: flex;
      flex-direction: column;
    }
    .nombre {
      font-size: var(--texto-dato);
      font-weight: 700;
      line-height: 1.3;
    }
    .detalle {
      font-size: var(--texto-chico);
      color: var(--c-texto-suave);
    }
    .bloque {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 12px;
      border-top: 1px solid var(--c-borde);
    }
    .parada {
      display: flex;
      flex-direction: column;
    }
    .parada-nombre {
      font-size: var(--texto-normal);
      font-weight: 700;
    }
    .caseta-fila {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .caseta-datos {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .caseta-nombre {
      font-size: var(--texto-caseta);
      font-weight: 700;
      line-height: 1.25;
    }
    .ya-la-pase {
      flex: none;
      padding: 0 14px;
      white-space: nowrap;
    }
    .ver-todas {
      align-self: flex-start;
      padding-left: 0;
    }
    .lista-casetas {
      display: grid;
      gap: 6px;
      margin: 0;
      padding-left: 22px;
    }
    .lista-casetas li {
      font-size: var(--texto-normal);
    }
    .lista-casetas .proxima {
      font-weight: 700;
    }
    .lista-estado {
      margin-left: 6px;
      color: var(--c-texto-suave);
      font-size: var(--texto-chico);
    }
    .mas-datos {
      padding-top: 4px;
      border-top: 1px solid var(--c-borde);
    }
    .mas-datos summary {
      display: flex;
      align-items: center;
      min-height: var(--alto-boton);
      color: var(--c-primario);
      font-weight: 700;
      cursor: pointer;
    }
    .abrir-mapa {
      min-height: var(--alto-boton-medio);
      border-radius: var(--radio-boton-medio);
      font-size: var(--texto-dato);
    }
  `,
})
export class HojaRutaPage implements OnInit {
  private readonly servicio = inject(HojaRutaService);
  private readonly asignacion = inject(AsignacionService);
  private readonly casetas = inject(CasetasService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);
  private readonly reloj = inject(RELOJ);

  protected readonly hoja = this.servicio.hojaRuta;
  protected readonly estado = this.servicio.estado;
  protected readonly error = this.servicio.error;
  protected readonly desdeCopia = this.servicio.desdeCopia;
  protected readonly avisoSalida = computed(() => avisoOtraSalida(this.hoja()?.folio, this.asignacion.asignacion()?.salida?.folio));
  /** "T-104 · al día 26 nov, 11:20 a. m." (cuándo se guardó en el teléfono lo que se ve). */
  protected readonly subtitulo = computed(() => {
    const h = this.hoja();
    if (!h) return null;
    const al = this.fechaHora(this.servicio.guardadaEn() ?? h.generadaEn);
    return `${h.unidad.numeroEconomico}${al ? ' · al día ' + al : ''}`;
  });
  private readonly abiertos = signal<ReadonlySet<number>>(new Set());

  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly fechaHora = (iso: string | null) => fechaHoraNegocio(iso, undefined, this.reloj());
  protected readonly fecha = fechaSinHora;
  protected readonly tel = ligaTelefono;
  protected readonly km = textoKm;
  protected readonly tiempo = textoTiempo;
  protected readonly parada = textoParada;

  ngOnInit(): void {
    void this.servicio.asegurar();
  }

  protected casetasDe(folioSalida: string, t: TramoHoja): EstadoCasetas | null {
    return estadoCasetas(t.ruta?.plazasCobro, this.casetas.pasadas(folioSalida, t.orden));
  }

  protected pasar(folioSalida: string, tramo: number, total: number): void {
    this.casetas.pasar(folioSalida, tramo, total);
  }

  protected regresar(folioSalida: string, tramo: number): void {
    this.casetas.regresar(folioSalida, tramo);
  }

  protected abierto(tramo: number): boolean {
    return this.abiertos().has(tramo);
  }

  protected alternar(tramo: number): void {
    const s = new Set(this.abiertos());
    if (!s.delete(tramo)) s.add(tramo);
    this.abiertos.set(s);
  }

  /** "96.5 km · 1 h 40 min". */
  protected distancia(t: TramoHoja): string {
    return [textoKm(t.ruta?.km ?? t.km), textoTiempo(t.ruta?.tiempo)].filter(Boolean).join(' · ');
  }

  /** Origen: la descripción y dirección; si no hay, la cita de carga. */
  protected lineaOrigen(t: TramoHoja): string {
    return detalleLugar(t.origen) || (t.citaCarga ? `Cita de carga: ${this.fechaHora(t.citaCarga)}` : '');
  }

  /** Destino: la cita; si no hay, la descripción y dirección. */
  protected lineaDestino(t: TramoHoja): string {
    return t.citaDescarga ? `Cita: ${this.fechaHora(t.citaDescarga)}` : detalleLugar(t.destino);
  }

  /** Lo demás del tramo, plegado para que la hoja se lea rápido. */
  protected masDatos(t: TramoHoja): { etiqueta: string; valor: string }[] {
    const d: { etiqueta: string; valor: string | null | undefined }[] = [
      { etiqueta: 'Folio', valor: t.folio },
      { etiqueta: 'Cliente', valor: t.cliente },
      { etiqueta: 'Cita de carga', valor: t.citaCarga && detalleLugar(t.origen) ? this.fechaHora(t.citaCarga) : null },
      { etiqueta: 'Dirección de destino', valor: t.citaDescarga ? detalleLugar(t.destino) : null },
      { etiqueta: 'Producto', valor: t.producto },
      { etiqueta: 'Toneladas programadas', valor: t.toneladasProgramadas != null ? textoToneladas(t.toneladasProgramadas) : null },
      { etiqueta: 'Referencia', valor: t.referencia },
      { etiqueta: 'Motivo del vacío', valor: t.motivo ? `${textoMotivo(t.motivo)}${t.motivoNota ? ' · ' + t.motivoNota : ''}` : null },
      { etiqueta: 'Ruta', valor: t.ruta?.nombre },
      { etiqueta: 'Notas', valor: t.notas },
    ];
    return d.filter((x): x is { etiqueta: string; valor: string } => !!x.valor);
  }

  protected async actualizar(): Promise<void> {
    if (this.estado() === 'cargando') {
      this.mensajes.mostrar('Ya se está actualizando, espere un momento.');
      return;
    }
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin señal: se muestra la hoja guardada. Se actualizará sola al volver la señal.', 'aviso');
      return;
    }
    await this.servicio.cargar();
    if (this.estado() === 'listo' && !this.desdeCopia()) this.mensajes.mostrar('Hoja de ruta actualizada.', 'exito', 2500);
  }
}
