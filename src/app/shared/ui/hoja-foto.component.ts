import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TipoEvidencia } from '../../core/api/operador-api-m2.modelos';
import { PuntoGps, Viaje } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { ColaEvidenciasService } from '../../core/evidencias/cola-evidencias.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { RELOJ } from '../../core/plataforma';
import { UbicacionService } from '../../core/ubicacion/ubicacion.service';
import { tituloViaje } from '../utils/estatus-viaje.util';
import { ETIQUETA_EVIDENCIA, LARGO_DESCRIPCION_FOTO, LARGO_NOTA_FOTO, MAX_BYTES_FOTO, TIPOS_FOTO, mensajeFoto } from '../utils/evidencias.util';
import { ErrorFoto, FotoReducida, HERRAMIENTAS_FOTO, liberarUrl, reducirFoto, urlDeImagen } from '../utils/foto.util';
import { ESPERA_GPS_MS, EXPLICACION_UBICACION, EstadoPermisoUbicacion, textoUbicacionEnReporte } from '../utils/ubicacion.util';
import { ahoraIsoUtc, msDeIso } from '../utils/zona-negocio.util';

const ESPERA_GPS_CON_PREGUNTA_MS = 20_000;
/** El servidor rechaza `tomadaEn` más de 10 minutos en el futuro. */
const FUTURO_MAXIMO_MS = 10 * 60 * 1000;

/**
 * Hoja "Agregar foto" de un viaje cargado: tomar con la cámara o elegir de la galería, tipo, descripción (obligatoria
 * con Otro) y nota. La foto se reduce aquí (1600 px, JPEG 80 %) y se guarda en la cola; nunca espera al GPS de más.
 */
@Component({
  selector: 'app-hoja-foto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="velo" (click)="cancelar()">
      <section class="hoja" role="dialog" aria-modal="true" aria-labelledby="titulo-foto" (click)="$event.stopPropagation()">
        <h2 id="titulo-foto">{{ reporteId() ? 'Foto del acuse de recibido' : 'Agregar foto' }}</h2>
        <p class="texto-suave">{{ titulo() }}</p>

        <input #camara class="oculto" type="file" accept="image/*" capture="environment" (change)="elegir($event, 'camara')" />
        <input #galeria class="oculto" type="file" accept="image/*" (change)="elegir($event, 'galeria')" />

        @if (vistaPrevia()) {
          <img class="vista-previa" [src]="vistaPrevia()" alt="Foto que se va a enviar" />
        }
        @if (preparando()) {
          <p class="alerta alerta-info" role="status">Preparando la foto…</p>
        }
        @if (errorArchivo()) {
          <p class="campo-error" role="alert">{{ errorArchivo() }}</p>
        }
        <div class="acciones fuente">
          <button type="button" class="btn btn-primario btn-bloque tomar" (click)="camara.click()">
            {{ foto() ? 'Tomar otra foto' : 'Tomar foto' }}
          </button>
          <button type="button" class="btn btn-secundario btn-bloque galeria" (click)="galeria.click()">Elegir de la galería</button>
        </div>

        <p class="etiqueta-campo">¿Qué es?</p>
        <div class="opciones" role="radiogroup" aria-label="Tipo de foto">
          @for (t of TIPOS; track t) {
            <button
              type="button"
              role="radio"
              class="btn btn-bloque opcion"
              [class.btn-primario]="tipo() === t"
              [class.btn-secundario]="tipo() !== t"
              [attr.aria-checked]="tipo() === t"
              (click)="tipo.set(t)"
            >
              {{ ETIQUETA[t] }}
            </button>
          }
        </div>

        @if (tipo() === 'Otro') {
          <div class="campo">
            <label for="descripcion-foto">Descripción (obligatoria)</label>
            <input id="descripcion-foto" type="text" [attr.maxlength]="LARGO_DESCRIPCION" [value]="descripcion()" (input)="escribir($event, 'descripcion')" />
          </div>
        }
        <div class="campo">
          <label for="nota-foto">Nota (opcional)</label>
          <textarea id="nota-foto" rows="2" [attr.maxlength]="LARGO_NOTA" [value]="nota()" (input)="escribir($event, 'nota')"></textarea>
        </div>

        @if (intento() && error()) {
          <p class="campo-error" role="alert">{{ error() }}</p>
        }

        @if (explicar()) {
          <p class="alerta alerta-info"><strong>Ubicación.</strong> {{ EXPLICACION }}</p>
        }
        <p class="texto-suave">{{ textoUbicacion(permiso()) }}</p>

        @if (buscandoUbicacion()) {
          <p class="alerta alerta-info" role="status">Buscando su ubicación…</p>
          <button type="button" class="btn btn-secundario btn-bloque" (click)="sinUbicacion()">Guardar sin ubicación</button>
        } @else {
          <div class="acciones">
            <button type="button" class="btn btn-primario btn-bloque guardar" [class.btn-ocupado]="guardando()" (click)="guardar()">
              {{ guardando() ? 'Guardando…' : 'Guardar y enviar' }}
            </button>
            <button type="button" class="btn btn-secundario btn-bloque" (click)="cancelar()">Cancelar</button>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .oculto {
      display: none;
    }
    .vista-previa {
      display: block;
      width: 100%;
      max-height: 40vh;
      object-fit: contain;
      border-radius: var(--radio-boton);
      margin: 0 0 var(--espacio-3);
      background: #000;
    }
    .opciones {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .etiqueta-campo {
      font-weight: 600;
      margin: 12px 0 6px;
    }
  `,
})
export class HojaFotoComponent implements OnInit {
  readonly viaje = input.required<Viaje>();
  readonly tipoInicial = input<TipoEvidencia | null>(null);
  /** Reporte al que queda ligada la foto (p. ej. el Descargado). */
  readonly reporteId = input<string | null>(null);
  readonly cerrar = output<void>();

  private readonly cola = inject(ColaEvidenciasService);
  private readonly ubicacion = inject(UbicacionService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);
  private readonly herramientas = inject(HERRAMIENTAS_FOTO);
  private readonly reloj = inject(RELOJ);

  protected readonly TIPOS = TIPOS_FOTO;
  protected readonly ETIQUETA = ETIQUETA_EVIDENCIA;
  protected readonly LARGO_DESCRIPCION = LARGO_DESCRIPCION_FOTO;
  protected readonly LARGO_NOTA = LARGO_NOTA_FOTO;
  protected readonly EXPLICACION = EXPLICACION_UBICACION;
  protected readonly textoUbicacion = textoUbicacionEnReporte;

  protected readonly titulo = computed(() => tituloViaje(this.viaje()));
  protected readonly tipo = signal<TipoEvidencia | null>(null);
  protected readonly descripcion = signal('');
  protected readonly nota = signal('');
  protected readonly foto = signal<FotoReducida | null>(null);
  protected readonly tomadaEn = signal<string | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly preparando = signal(false);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly buscandoUbicacion = signal(false);
  protected readonly permiso = signal<EstadoPermisoUbicacion>('desconocido');
  protected readonly explicar = signal(false);
  protected readonly error = computed(() => mensajeFoto(this.tipo(), this.descripcion(), !!this.foto()));
  private omitirUbicacion: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => liberarUrl(this.vistaPrevia()));
  }

  async ngOnInit(): Promise<void> {
    this.tipo.set(this.tipoInicial());
    this.permiso.set(await this.ubicacion.estadoPermiso());
    this.explicar.set(await this.ubicacion.necesitaExplicacion());
  }

  protected async elegir(evento: Event, origen: 'camara' | 'galeria'): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = ''; // permite elegir la misma foto otra vez
    if (!archivo) return;
    this.errorArchivo.set(null);
    this.preparando.set(true);
    try {
      const reducida = await reducirFoto(archivo, this.herramientas);
      if (reducida.blob.size > MAX_BYTES_FOTO) throw new ErrorFoto('La foto quedó de más de 5 MB. Tómela de nuevo.');
      liberarUrl(this.vistaPrevia());
      this.vistaPrevia.set(urlDeImagen(reducida.blob));
      this.foto.set(reducida);
      this.tomadaEn.set(this.horaDeToma(archivo, origen));
    } catch (e) {
      this.errorArchivo.set(e instanceof ErrorFoto ? e.message : 'No se pudo preparar la foto. Intente de nuevo.');
    } finally {
      this.preparando.set(false);
    }
  }

  protected escribir(evento: Event, campo: 'descripcion' | 'nota'): void {
    const valor = (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (campo === 'descripcion') this.descripcion.set(valor.slice(0, LARGO_DESCRIPCION_FOTO));
    else this.nota.set(valor.slice(0, LARGO_NOTA_FOTO));
  }

  protected sinUbicacion(): void {
    this.omitirUbicacion?.();
  }

  protected cancelar(): void {
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando la foto.');
      return;
    }
    this.cerrar.emit();
  }

  protected async guardar(): Promise<void> {
    if (this.guardando() || this.preparando()) return;
    this.intento.set(true);
    if (this.error()) return;
    this.guardando.set(true);
    const v = this.viaje();
    try {
      if (this.explicar()) this.ubicacion.marcarExplicada();
      const ubicacion = await this.puntoSinBloquear();
      await this.cola.registrar({
        datos: {
          viajeId: v.id,
          tipo: this.tipo()!,
          descripcion: this.tipo() === 'Otro' ? this.descripcion() : null,
          nota: this.nota(),
          reporteId: this.reporteId(),
          tomadaEn: this.tomadaEn(),
          ubicacion,
        },
        foto: this.foto()!.blob,
        resumen: tituloViaje(v),
      });
      this.mensajes.mostrar(
        this.conexion.enLinea() ? 'Foto guardada. Enviando a la oficina…' : 'Foto guardada en el teléfono. Se enviará sola cuando vuelva la señal.',
        'exito',
      );
      this.cerrar.emit();
    } catch {
      this.mensajes.mostrar('No se pudo guardar la foto en el teléfono. Intente de nuevo.', 'error', 8000);
    } finally {
      this.guardando.set(false);
      this.buscandoUbicacion.set(false);
      this.omitirUbicacion = null;
    }
  }

  /** Cámara: ahora. Galería: la fecha del archivo si es válida y no está en el futuro; si no, sin hora. */
  private horaDeToma(archivo: File, origen: 'camara' | 'galeria'): string | null {
    const ahora = this.reloj();
    if (origen === 'camara') return ahoraIsoUtc(ahora);
    const ms = archivo.lastModified;
    if (!Number.isFinite(ms) || ms <= 0 || ms > ahora.getTime() + FUTURO_MAXIMO_MS) return null;
    const iso = ahoraIsoUtc(new Date(ms));
    return msDeIso(iso) == null ? null : iso;
  }

  /** Igual que en los reportes: sin permiso, sin GPS, si tarda o si el operador no quiere esperar, sigue sin punto. */
  private async puntoSinBloquear(): Promise<PuntoGps | null> {
    const permiso = this.permiso();
    if (permiso === 'negado' || permiso === 'no-disponible') return null;
    this.buscandoUbicacion.set(true);
    const omitida = new Promise<null>((resolver) => (this.omitirUbicacion = () => resolver(null)));
    try {
      return await Promise.race([this.ubicacion.obtenerPunto(permiso === 'concedido' ? ESPERA_GPS_MS : ESPERA_GPS_CON_PREGUNTA_MS), omitida]);
    } finally {
      this.buscandoUbicacion.set(false);
    }
  }
}
