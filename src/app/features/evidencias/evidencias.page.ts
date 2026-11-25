import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConexionService } from '../../core/conexion/conexion.service';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { AsignacionService } from '../../core/viaje/asignacion.service';
import { EncabezadoComponent } from '../../shared/ui/encabezado.component';
import { FotoItemComponent } from '../../shared/ui/foto-item.component';
import { ETIQUETA_ESTADO_FOTO, textoFotosPendientes } from '../../shared/utils/evidencias.util';
import { viajesEnOrden } from '../../shared/utils/estatus-viaje.util';

/** Las fotos de evidencia guardadas en este teléfono, con su estado, y acceso a los viajes cargados. Ruta /evidencias. */
@Component({
  selector: 'app-evidencias',
  imports: [RouterLink, EncabezadoComponent, FotoItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-encabezado titulo="Evidencias" volver="/viaje" />
    <main class="pagina">
      <p class="texto-suave">Las fotos se guardan primero en el teléfono y se envían solas cuando hay señal.</p>

      @if (cargados().length) {
        <section class="tarjeta" aria-labelledby="titulo-agregar">
          <h2 id="titulo-agregar">Agregar foto a un viaje</h2>
          @for (v of cargados(); track v.id) {
            <a class="btn btn-secundario btn-bloque ir-viaje" [routerLink]="['/viaje', v.id]">Viaje {{ v.orden }} · {{ v.folio }}</a>
          }
        </section>
      }

      @if (cola.avisoAcumuladas()) {
        <p class="alerta alerta-aviso" role="status">{{ cola.avisoAcumuladas() }}</p>
      } @else if (cola.pendientes()) {
        <p class="alerta alerta-info" role="status">{{ textoPendientes(cola.pendientes()) }}{{ cola.enviando() ? ' · enviando…' : '' }}</p>
      }

      @if (!cola.persistente()) {
        <p class="alerta alerta-aviso">Este navegador no guarda las fotos al cerrar la app (¿navegación privada?). Envíelas antes de cerrar.</p>
      }

      @if (cola.fotos().length) {
        <div class="acciones">
          <button type="button" class="btn btn-secundario btn-bloque" (click)="enviarAhora()">Enviar pendientes ahora</button>
          <button type="button" class="btn btn-texto btn-bloque" (click)="actualizarEstados()">Consultar a la oficina</button>
        </div>
        @for (f of cola.fotos(); track f.id) {
          <app-foto-item [foto]="f" />
        }
        <ul class="leyenda texto-suave">
          @for (e of estados; track e) {
            <li><span class="chip chip-{{ e }}">{{ ETIQUETA[e] }}</span></li>
          }
        </ul>
        <p class="texto-suave">La app no anula fotos. Si subió una por error, avise a la oficina.</p>
      } @else {
        <p class="estado-vacio sin-fotos">Todavía no ha tomado fotos de evidencia en este teléfono.</p>
      }
    </main>
  `,
  styles: `
    .leyenda {
      display: flex;
      flex-wrap: wrap;
      gap: var(--espacio-2);
      padding: 0;
      margin: var(--espacio-4) 0;
      list-style: none;
    }
    .ir-viaje {
      margin-bottom: 8px;
    }
  `,
})
export class EvidenciasPage implements OnInit {
  protected readonly cola = inject(ColaEvidenciasService);
  private readonly asignacion = inject(AsignacionService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);

  protected readonly ETIQUETA = ETIQUETA_ESTADO_FOTO;
  protected readonly estados = Object.keys(ETIQUETA_ESTADO_FOTO) as (keyof typeof ETIQUETA_ESTADO_FOTO)[];
  protected readonly textoPendientes = textoFotosPendientes;
  /** Solo los viajes cargados no cancelados reciben fotos (P8 a). */
  protected readonly cargados = computed(() =>
    viajesEnOrden(this.asignacion.asignacion()?.salida ?? null).filter((v) => v.tipo === 'cargado' && v.estatus !== 'Cancelado'),
  );

  ngOnInit(): void {
    void this.asignacion.asegurar();
    void this.cola.actualizarEstados();
  }

  protected async enviarAhora(): Promise<void> {
    if (!this.cola.pendientes()) {
      this.mensajes.mostrar('No tiene fotos pendientes de enviar.');
      return;
    }
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin conexión. Sus fotos están guardadas y se enviarán solas al volver la señal.', 'aviso');
      return;
    }
    await this.cola.procesar();
    const faltan = this.cola.pendientes();
    this.mensajes.mostrar(faltan ? `${textoFotosPendientes(faltan)}. Se reintentará sola.` : 'Fotos enviadas.', faltan ? 'aviso' : 'exito');
  }

  protected async actualizarEstados(): Promise<void> {
    if (!this.conexion.enLinea()) {
      this.mensajes.mostrar('Sin conexión: no se puede consultar a la oficina ahora.', 'aviso');
      return;
    }
    await this.cola.actualizarEstados();
    this.mensajes.mostrar('Estados actualizados.', 'exito', 2500);
  }
}
