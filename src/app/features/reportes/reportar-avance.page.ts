import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ObjetivoReporte, PuntoGps, TipoAvance } from '../../core/api/operador-api.modelos';
import { ConexionService } from '../../core/conexion/conexion.service';
import { AsignacionService } from '../../core/despacho/asignacion.service';
import { MensajesService } from '../../core/mensajes/mensajes.service';
import { ColaReportesService } from '../../core/reportes/cola-reportes.service';
import { UbicacionService } from '../../core/ubicacion/ubicacion.service';
import { ReporteItemComponent } from '../../shared/ui/reporte-item.component';
import {
  AVANCES_VACIO,
  ETIQUETA_AVANCE,
  avancesDeTramo,
  claveObjetivo,
  estaTerminado,
  objetivoDeMovimiento,
  objetivoDeTramo,
  reportesDelObjetivo,
  siguienteAvance,
  tituloMovimiento,
  tituloTramo,
  tramoQueToca,
  ultimoDeAvance,
} from '../../shared/utils/avances.util';
import {
  ESPERA_GPS_MS,
  EXPLICACION_UBICACION,
  EstadoPermisoUbicacion,
  textoUbicacionEnReporte,
} from '../../shared/utils/ubicacion.util';
import { TEXTO_ZONA_NEGOCIO, ahoraIsoUtc, cuandoNegocio, fechaHoraNegocio } from '../../shared/utils/zona-negocio.util';

/** Si el teléfono va a preguntar por el permiso, se da más tiempo para que el operador lea y conteste. */
const ESPERA_GPS_CON_PREGUNTA_MS = 20_000;
const LARGO_NOTA = 500;

interface Objetivo {
  objetivo: ObjetivoReporte;
  titulo: string;
  secuencia: readonly TipoAvance[];
  /** Solo tramos: ¿es el que toca? */
  esElQueToca: boolean;
  /** Texto del tramo que sí toca, si este no lo es. */
  queToca: string | null;
  nombre: 'tramo' | 'movimiento';
}

interface Borrador {
  avance: TipoAvance;
  ocurrioEn: string;
  repetidoCuando: string | null;
  permiso: EstadoPermisoUbicacion;
  explicarUbicacion: boolean;
}

@Component({
  selector: 'app-reportar-avance',
  imports: [RouterLink, ReporteItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reportar-avance.page.html',
  styleUrl: './reportar-avance.page.scss',
})
export class ReportarAvancePage implements OnInit {
  /** De la ruta /avance/:tipo/:id. */
  readonly tipo = input<string>('');
  readonly id = input<string>('');

  private readonly asignacionSrv = inject(AsignacionService);
  private readonly cola = inject(ColaReportesService);
  private readonly ubicacion = inject(UbicacionService);
  private readonly conexion = inject(ConexionService);
  private readonly mensajes = inject(MensajesService);

  protected readonly ETIQUETA = ETIQUETA_AVANCE;
  protected readonly EXPLICACION_UBICACION = EXPLICACION_UBICACION;
  protected readonly TEXTO_ZONA = TEXTO_ZONA_NEGOCIO;
  protected readonly LARGO_NOTA = LARGO_NOTA;
  protected readonly fechaHora = fechaHoraNegocio;
  protected readonly textoUbicacion = textoUbicacionEnReporte;

  protected readonly estadoCarga = this.asignacionSrv.estado;
  protected readonly borrador = signal<Borrador | null>(null);
  protected readonly nota = signal('');
  protected readonly guardando = signal(false);
  protected readonly buscandoUbicacion = signal(false);
  private omitirUbicacion: (() => void) | null = null;

  protected readonly objetivo = computed<Objetivo | null>(() => {
    const a = this.asignacionSrv.asignacion();
    if (!a) return null;
    if (this.tipo() === 'tramo' && a.despacho) {
      const d = a.despacho;
      const t = d.tramos.find((x) => x.id === this.id());
      if (!t) return null;
      const toca = tramoQueToca(d, this.cola.reportes());
      return {
        objetivo: objetivoDeTramo(d, t),
        titulo: tituloTramo(t),
        secuencia: avancesDeTramo(t),
        esElQueToca: toca === t,
        queToca: toca && toca !== t ? `Tramo ${toca.orden}` : null,
        nombre: 'tramo',
      };
    }
    if (this.tipo() === 'movimiento') {
      const m = a.movimientosVacio.find((x) => x.id === this.id());
      if (!m) return null;
      return { objetivo: objetivoDeMovimiento(m), titulo: tituloMovimiento(m), secuencia: AVANCES_VACIO, esElQueToca: true, queToca: null, nombre: 'movimiento' };
    }
    return null;
  });

  protected readonly reportes = computed(() => {
    const o = this.objetivo();
    return o ? reportesDelObjetivo(this.cola.reportes(), o.objetivo) : [];
  });
  /** Para la lista: lo más reciente primero, incluidos los no aceptados. */
  protected readonly historial = computed(() => {
    const o = this.objetivo();
    if (!o) return [];
    const clave = claveObjetivo(o.objetivo);
    return this.cola.reportes().filter((r) => claveObjetivo(r.reporte.objetivo) === clave);
  });
  protected readonly siguiente = computed(() => {
    const o = this.objetivo();
    return o ? siguienteAvance(o.secuencia, this.reportes()) : null;
  });
  protected readonly terminado = computed(() => estaTerminado(this.reportes()));

  ngOnInit(): void {
    void this.asignacionSrv.asegurar();
  }

  protected hechoCuando(avance: TipoAvance): string | null {
    const r = ultimoDeAvance(this.reportes(), avance);
    return r ? cuandoNegocio(r.reporte.ocurrioEn) : null;
  }

  /** Toca un avance: se toma la hora en ese momento y se pide confirmar. */
  protected async abrir(avance: TipoAvance): Promise<void> {
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando el reporte anterior.');
      return;
    }
    const ocurrioEn = ahoraIsoUtc();
    const permiso = await this.ubicacion.estadoPermiso();
    const explicarUbicacion = await this.ubicacion.necesitaExplicacion();
    this.nota.set('');
    this.borrador.set({ avance, ocurrioEn, repetidoCuando: this.hechoCuando(avance), permiso, explicarUbicacion });
  }

  protected cancelar(): void {
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando su reporte.');
      return;
    }
    this.borrador.set(null);
  }

  protected escribirNota(evento: Event): void {
    this.nota.set((evento.target as HTMLTextAreaElement).value.slice(0, LARGO_NOTA));
  }

  /** "Enviar sin ubicación": deja de esperar al GPS. */
  protected sinUbicacion(): void {
    this.omitirUbicacion?.();
  }

  protected async confirmar(): Promise<void> {
    const b = this.borrador();
    const o = this.objetivo();
    if (!b || !o) return;
    if (this.guardando()) {
      this.mensajes.mostrar('Espere, se está guardando su reporte.');
      return;
    }
    this.guardando.set(true);
    try {
      if (b.explicarUbicacion) this.ubicacion.marcarExplicada();
      const ubicacion = await this.puntoSinBloquear(b.permiso);
      await this.cola.registrar({
        objetivo: o.objetivo,
        avance: b.avance,
        ocurrioEn: b.ocurrioEn,
        ubicacion,
        nota: this.nota(),
        resumen: o.titulo,
      });
      this.borrador.set(null);
      this.mensajes.mostrar(
        this.conexion.enLinea()
          ? `“${ETIQUETA_AVANCE[b.avance]}” guardado. Enviando a la oficina…`
          : `“${ETIQUETA_AVANCE[b.avance]}” guardado en el teléfono. Se enviará solo cuando vuelva la señal.`,
        'exito',
      );
    } catch {
      this.mensajes.mostrar('No se pudo guardar el reporte en el teléfono. Intente de nuevo.', 'error', 8000);
    } finally {
      this.guardando.set(false);
      this.buscandoUbicacion.set(false);
      this.omitirUbicacion = null;
    }
  }

  /** Nunca bloquea: sin permiso, sin GPS, si tarda o si el operador decide no esperar, sigue sin punto. */
  private async puntoSinBloquear(permiso: EstadoPermisoUbicacion): Promise<PuntoGps | null> {
    if (permiso === 'negado' || permiso === 'no-disponible') return null;
    this.buscandoUbicacion.set(true);
    const omitida = new Promise<null>((resolver) => (this.omitirUbicacion = () => resolver(null)));
    const espera = permiso === 'concedido' ? ESPERA_GPS_MS : ESPERA_GPS_CON_PREGUNTA_MS;
    try {
      return await Promise.race([this.ubicacion.obtenerPunto(espera), omitida]);
    } finally {
      this.buscandoUbicacion.set(false);
    }
  }
}
