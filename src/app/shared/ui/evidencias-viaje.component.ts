import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { EvidenciaViaje } from '../../core/api/operador-api-m2.modelos';
import { Viaje } from '../../core/api/operador-api.modelos';
import { OPERADOR_API, comoErrorApi } from '../../core/api/operador-api';
import { ConexionService } from '../../core/conexion/conexion.service';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { AlmacenSesion, MENSAJE_SESION_VENCIDA } from '../../core/sesion/almacen-sesion';
import { TEXTO_FOTO_CANCELADO, admiteFotos, textoEvidencia } from '../utils/evidencias.util';
import { liberarUrl, urlDeImagen } from '../utils/foto.util';
import { fechaHoraNegocio } from '../utils/zona-negocio.util';
import { FotoItemComponent } from './foto-item.component';
import { HojaFotoComponent } from './hoja-foto.component';
import { SugerenciaAcuseComponent } from './sugerencia-acuse.component';

interface FotoVista {
  estado: 'cargando' | 'lista' | 'sin-imagen' | 'error';
  url: string | null;
}

/**
 * Evidencias de UN viaje cargado (contrato M2, sección 2):
 *  - "Agregar foto" (no en vacíos ni en cancelados), y la sugerencia del acuse tras Descargado.
 *  - Las fotos de este teléfono con su estado (cola).
 *  - La galería del viaje en el servidor: las suyas se descargan con el token al tocar "Ver foto" y se muestran como
 *    blob; las de la oficina aparecen solo como renglón (su archivo da 404 y eso no es un error).
 */
@Component({
  selector: 'app-evidencias-viaje',
  imports: [FotoItemComponent, HojaFotoComponent, SugerenciaAcuseComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="evidencias" aria-labelledby="titulo-evidencias-{{ viaje().id }}">
      <h2 class="titulo-seccion" id="titulo-evidencias-{{ viaje().id }}">Fotos de evidencia</h2>

      @if (admite()) {
        <app-sugerencia-acuse [viajes]="[viaje()]" />
        <button type="button" class="btn btn-primario btn-bloque agregar-foto" (click)="agregando.set(true)">📷 Agregar foto</button>
      } @else {
        <p class="alerta alerta-aviso foto-no-admitida">{{ TEXTO_CANCELADO }}</p>
      }
      @if (avisoAcumuladas()) {
        <p class="alerta alerta-aviso" role="status">{{ avisoAcumuladas() }}</p>
      }

      @if (locales().length) {
        <h3>En este teléfono</h3>
        @for (f of locales(); track f.id) {
          <app-foto-item [foto]="f" [mostrarResumen]="false" />
        }
      }

      <h3>Galería del viaje</h3>
      @if (cargandoGaleria()) {
        <p class="texto-suave" role="status">Cargando la galería…</p>
      } @else if (errorGaleria()) {
        <p class="alerta alerta-aviso galeria-error" role="status">{{ errorGaleria() }}</p>
      } @else if (galeria().length === 0) {
        <p class="estado-vacio galeria-vacia">Todavía no hay fotos de este viaje en la oficina.</p>
      }
      @for (e of galeria(); track e.id) {
        <article class="tarjeta galeria-item" [class.de-oficina]="e.autor === 'oficina'">
          <div class="tarjeta-cabeza">
            <h4>{{ tipo(e) }}</h4>
            <span class="texto-suave">{{ fecha(e.subidaEn) }}</span>
          </div>
          @if (e.autor === 'oficina') {
            <p class="foto-oficina">Subida por la oficina</p>
          } @else {
            @let vista = vistas()[e.id];
            @if (vista?.url) {
              <img class="foto-servidor" [src]="vista!.url" [alt]="'Foto: ' + tipo(e)" />
            } @else if (vista?.estado === 'cargando') {
              <p class="texto-suave" role="status">Descargando la foto…</p>
            } @else if (vista?.estado === 'sin-imagen') {
              <p class="texto-suave">La foto ya no está disponible.</p>
            } @else {
              @if (vista?.estado === 'error') {
                <p class="texto-suave">No se pudo descargar. Revise su señal.</p>
              }
              <button type="button" class="btn btn-secundario btn-bloque ver-foto" (click)="verFoto(e)">Ver foto</button>
            }
          }
          @if (e.nota) {
            <p class="texto-suave">“{{ e.nota }}”</p>
          }
        </article>
      }
    </section>

    @if (agregando()) {
      <app-hoja-foto [viaje]="viaje()" (cerrar)="agregando.set(false)" />
    }
  `,
  styles: `
    .evidencias {
      margin-top: 8px;
    }
    .agregar-foto {
      margin-bottom: 12px;
    }
    .galeria-item h4 {
      margin: 0;
      font-size: var(--texto-dato);
    }
    .foto-oficina {
      font-weight: 600;
      margin: 6px 0 0;
    }
    .foto-servidor {
      display: block;
      width: 100%;
      max-height: 60vh;
      object-fit: contain;
      border-radius: var(--radio-boton);
      margin-top: var(--espacio-2);
      background: #000;
    }
  `,
})
export class EvidenciasViajeComponent implements OnInit {
  readonly viaje = input.required<Viaje>();

  private readonly api = inject(OPERADOR_API);
  private readonly cola = inject(ColaEvidenciasService);
  private readonly conexion = inject(ConexionService);
  private readonly sesion = inject(AlmacenSesion);

  protected readonly TEXTO_CANCELADO = TEXTO_FOTO_CANCELADO;
  protected readonly fecha = (iso: string) => fechaHoraNegocio(iso);
  protected readonly admite = computed(() => admiteFotos(this.viaje()));
  protected readonly locales = computed(() => this.cola.fotos().filter((f) => f.datos.viajeId === this.viaje().id));
  protected readonly avisoAcumuladas = this.cola.avisoAcumuladas;
  protected readonly agregando = signal(false);
  protected readonly galeria = signal<EvidenciaViaje[]>([]);
  protected readonly cargandoGaleria = signal(false);
  protected readonly errorGaleria = signal<string | null>(null);
  protected readonly vistas = signal<Record<string, FotoVista>>({});

  constructor() {
    inject(DestroyRef).onDestroy(() => Object.values(this.vistas()).forEach((v) => liberarUrl(v.url)));
  }

  ngOnInit(): void {
    void this.cola.actualizarEstados();
    void this.cargarGaleria();
  }

  protected tipo(e: EvidenciaViaje): string {
    return e.tipo === 'Otro' && e.descripcion ? `Otro: ${e.descripcion}` : textoEvidencia(e.tipo);
  }

  async cargarGaleria(): Promise<void> {
    if (!this.conexion.enLinea()) {
      this.errorGaleria.set('Sin conexión: la galería del viaje se ve con señal. Sus fotos guardadas están arriba.');
      return;
    }
    this.cargandoGaleria.set(true);
    try {
      const lista = await this.api.evidenciasDeViaje(this.viaje().id);
      this.galeria.set([...lista].sort((a, b) => b.subidaEn.localeCompare(a.subidaEn)));
      this.errorGaleria.set(null);
    } catch (e) {
      if (comoErrorApi(e).tipo === 'sesion') this.sesion.vencer(MENSAJE_SESION_VENCIDA);
      this.errorGaleria.set('No se pudo cargar la galería del viaje. Intente más tarde.');
    } finally {
      this.cargandoGaleria.set(false);
    }
  }

  /** Solo fotos del operador: se piden con el token (no hay ligas públicas) y se muestran como blob. */
  protected async verFoto(e: EvidenciaViaje): Promise<void> {
    if (e.autor !== 'operador') return;
    this.ponerVista(e.id, { estado: 'cargando', url: null });
    try {
      const archivo = await this.api.archivoEvidencia(e.id);
      // 404 (anulada o ya no disponible): no es un error, solo no hay imagen.
      this.ponerVista(e.id, archivo ? { estado: 'lista', url: urlDeImagen(archivo) } : { estado: 'sin-imagen', url: null });
    } catch (err) {
      if (comoErrorApi(err).tipo === 'sesion') this.sesion.vencer(MENSAJE_SESION_VENCIDA);
      this.ponerVista(e.id, { estado: 'error', url: null });
    }
  }

  private ponerVista(id: string, v: FotoVista): void {
    this.vistas.update((todas) => {
      liberarUrl(todas[id]?.url ?? null);
      return { ...todas, [id]: v };
    });
  }
}
