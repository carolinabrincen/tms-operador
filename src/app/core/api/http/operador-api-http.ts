import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, Subject, firstValueFrom, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NAVEGADOR } from '../../plataforma';
import { ALMACEN_CREDENCIALES } from '../../sesion/almacen-credenciales';
import { ErrorApiOperador, OperadorApi } from '../operador-api';
import { AcuseEvidencia, DatosEvidencia, EstadoRemotoEvidencia, EvidenciaViaje, HojaRuta } from '../operador-api-m2.modelos';
import { AcuseReporte, AsignacionOperador, EstadoRemotoReporte, ReporteOperador, SesionOperador } from '../operador-api.modelos';
import { ContextoPeticion, MENSAJES, clasificarError } from './errores-api.util';
import {
  Credenciales,
  MAX_IDS_ESTADO,
  acuseDesdeApi,
  asignacionDesdeApi,
  estadosDesdeApi,
  reporteParaApi,
  sesionDesdeApi,
} from './mapeo-api.util';
import {
  acuseEvidenciaDesdeApi,
  camposEvidencia,
  estadosEvidenciaDesdeApi,
  evidenciasDeViajeDesdeApi,
  hojaRutaDesdeApi,
  nombreArchivoEvidencia,
} from './mapeo-m2-api.util';

/** Base de la API (la misma de la oficina, con /api). Las rutas del operador cuelgan de `${base}/operador`. */
export const API_URL = new InjectionToken<string>('API_URL', { providedIn: 'root', factory: () => environment.apiUrl });

/** Nombre del Web Lock que serializa la renovación entre pestañas. */
export const NOMBRE_LOCK_RENOVACION = 'ct-operador-renovar';

/**
 * Cuánto se espera al servidor al salir antes de borrar de todos modos (ms). Salir nunca se bloquea: sin señal o con
 * el servidor lento, se borra en el teléfono y listo.
 */
export const ESPERA_CIERRE_SESION_MS = new InjectionToken<number>('ESPERA_CIERRE_SESION_MS', { providedIn: 'root', factory: () => 4000 });

type Metodo = 'GET' | 'POST';

interface OpcionesPeticion {
  /** Al emitir, la petición se cancela (cuenta como sin conexión). */
  cancelar?: Observable<void>;
  params?: Record<string, string>;
  /** La respuesta es un archivo (Blob), no JSON. */
  archivo?: boolean;
}

/**
 * Implementación REAL de OperadorApi (contratos M1 y M2).
 *
 * Sesión:
 *  - Login y renovación guardan token y refresh en IndexedDB (AlmacenCredenciales). Nunca salen de aquí: no se
 *    imprimen, no van en mensajes de error y las pantallas no los ven.
 *  - Al salir se avisa al servidor (cierra solo esta sesión) y se borran token y refresh aunque el aviso falle.
 *  - Ante un 401 se renueva UNA vez y se repite la petición. Si renovar da 401, se borran las credenciales y se
 *    rechaza con 'sesion' (la app pide el PIN; la cola de reportes no se toca).
 *  - El refresh es rotativo y usar uno ya usado cierra TODAS las sesiones del operador: la renovación va de una en una
 *    (en la pestaña y, con Web Locks, entre pestañas). Dentro del candado se relee lo guardado: si otra pestaña ya
 *    renovó, se usa lo suyo en vez de gastar el refresh viejo.
 */
export class OperadorApiHttp implements OperadorApi {
  readonly esEjemplo = false;

  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL).replace(/\/+$/, '')}/operador`;
  private readonly almacen = inject(ALMACEN_CREDENCIALES);
  private readonly navegador = inject(NAVEGADOR);
  private readonly esperaCierreMs = inject(ESPERA_CIERRE_SESION_MS);
  private renovando: Promise<Credenciales> | null = null;

  async iniciarSesion(celular: string, pin: string): Promise<SesionOperador> {
    const json = await this.peticion('POST', 'sesion', { celular, pin }, null, 'login');
    const { perfil, credenciales } = sesionDesdeApi(json);
    await this.almacen.guardar(credenciales);
    return perfil;
  }

  async renovarSesion(): Promise<void> {
    await this.renovar(null);
  }

  /**
   * Cierra ESTA sesión en el servidor (1.3: 204 siempre, solo este teléfono) y después borra token y refresh del
   * teléfono. Si no hay señal, el servidor falla o tarda más de ESPERA_CIERRE_SESION_MS, se borra igual.
   */
  async cerrarSesion(): Promise<void> {
    const cancelar = new Subject<void>();
    let limite: ReturnType<typeof setTimeout> | undefined;
    const tiempoAgotado = new Promise<void>((resolver) => (limite = setTimeout(resolver, this.esperaCierreMs)));
    try {
      await Promise.race([this.avisarCierre(cancelar).catch(() => undefined), tiempoAgotado]);
    } finally {
      clearTimeout(limite);
      cancelar.next(); // si el servidor no contestó a tiempo, se cancela la petición
      cancelar.complete();
      await this.almacen.borrar();
    }
  }

  async obtenerAsignacion(): Promise<AsignacionOperador> {
    return asignacionDesdeApi(await this.autorizada('GET', 'asignacion'));
  }

  async enviarReporte(reporte: ReporteOperador): Promise<AcuseReporte> {
    return acuseDesdeApi(await this.autorizada('POST', 'reportes', reporteParaApi(reporte)));
  }

  async consultarReportes(ids: string[]): Promise<EstadoRemotoReporte[]> {
    const estados: EstadoRemotoReporte[] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS_ESTADO) {
      const lote = ids.slice(i, i + MAX_IDS_ESTADO);
      estados.push(...estadosDesdeApi(await this.autorizada('POST', 'reportes/estado', { ids: lote })));
    }
    return estados;
  }

  // ------------------------------------------------------------------ M2: hoja de ruta y evidencias

  async obtenerHojaRuta(): Promise<HojaRuta | null> {
    return hojaRutaDesdeApi(await this.autorizada('GET', 'hoja-ruta'));
  }

  /** multipart/form-data: `archivo` y los campos de texto (2.1). 201 y 200 (reintento) dan el mismo acuse. */
  async subirEvidencia(foto: Blob, datos: DatosEvidencia): Promise<AcuseEvidencia> {
    const forma = new FormData();
    for (const [k, v] of camposEvidencia(datos)) forma.append(k, v);
    forma.append('archivo', foto, nombreArchivoEvidencia(datos.id, foto.type));
    return acuseEvidenciaDesdeApi(await this.autorizada('POST', 'evidencias', forma));
  }

  async consultarEvidencias(ids: string[]): Promise<EstadoRemotoEvidencia[]> {
    const estados: EstadoRemotoEvidencia[] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS_ESTADO) {
      const lote = ids.slice(i, i + MAX_IDS_ESTADO);
      estados.push(...estadosEvidenciaDesdeApi(await this.autorizada('POST', 'evidencias/estado', { ids: lote })));
    }
    return estados;
  }

  async evidenciasDeViaje(viajeId: string): Promise<EvidenciaViaje[]> {
    return evidenciasDeViajeDesdeApi(await this.autorizada('GET', 'evidencias', undefined, { params: { viajeId } }));
  }

  /** Con el token (no hay ligas públicas). 404 = de la oficina, anulada o ajena: no es un error, no hay imagen. */
  async archivoEvidencia(id: string): Promise<Blob | null> {
    try {
      const archivo = await this.autorizada('GET', `evidencias/${encodeURIComponent(id)}/archivo`, undefined, { archivo: true });
      return archivo instanceof Blob ? archivo : null;
    } catch (e) {
      if (e instanceof ErrorApiOperador && e.status === 404) return null;
      throw e;
    }
  }

  // ------------------------------------------------------------------ internos

  /** POST sesion/cerrar con el refresh guardado. Si hay una renovación en curso, se espera (el refresh cambia). */
  private async avisarCierre(cancelar: Observable<void>): Promise<void> {
    await this.renovando?.catch(() => undefined);
    const credenciales = await this.almacen.leer();
    if (!credenciales) return;
    await this.peticion('POST', 'sesion/cerrar', { refreshToken: credenciales.refreshToken }, null, 'renovar', { cancelar });
  }

  /** Petición con token. 401 → renovar una vez y repetir; si vuelve el 401, 'sesion'. */
  private async autorizada(metodo: Metodo, ruta: string, cuerpo?: unknown, opciones: OpcionesPeticion = {}): Promise<unknown> {
    const guardadas = await this.almacen.leer();
    // Sin token (p. ej. se perdió): se intenta con el refresh antes de molestar al operador.
    const credenciales = guardadas ?? (await this.renovar(null));
    try {
      return await this.peticion(metodo, ruta, cuerpo, credenciales.token, 'general', opciones);
    } catch (e) {
      if (!(e instanceof ErrorApiOperador) || e.status !== 401) throw e;
    }
    const nuevas = await this.renovar(credenciales.token);
    return this.peticion(metodo, ruta, cuerpo, nuevas.token, 'general', opciones);
  }

  /** Una sola renovación a la vez. `tokenQueFallo`: el token que recibió el 401 (null si no había). */
  private renovar(tokenQueFallo: string | null): Promise<Credenciales> {
    this.renovando ??= this.conCandado(() => this.renovarDentroDelCandado(tokenQueFallo)).finally(() => (this.renovando = null));
    return this.renovando;
  }

  private async renovarDentroDelCandado(tokenQueFallo: string | null): Promise<Credenciales> {
    const actuales = await this.almacen.leer();
    if (!actuales) throw new ErrorApiOperador('sesion', MENSAJES.sesionTerminada);
    // Otra pestaña ya renovó mientras esperábamos: su token es nuevo y su refresh aún no se usa.
    if (tokenQueFallo && actuales.token !== tokenQueFallo) return actuales;
    try {
      const json = await this.peticion('POST', 'sesion/renovar', { refreshToken: actuales.refreshToken }, null, 'renovar');
      const { credenciales } = sesionDesdeApi(json);
      await this.almacen.guardar(credenciales);
      return credenciales;
    } catch (e) {
      // Refresh inválido, vencido, usado o revocado: ya no sirve; hay que pedir el PIN.
      if (e instanceof ErrorApiOperador && e.tipo === 'sesion') await this.almacen.borrar();
      throw e;
    }
  }

  private async conCandado<T>(fn: () => Promise<T>): Promise<T> {
    const locks = this.navegador?.locks;
    if (!locks?.request) return fn();
    return locks.request(NOMBRE_LOCK_RENOVACION, fn) as Promise<T>;
  }

  /** Una petición HTTP. Cualquier error sale ya traducido a ErrorApiOperador (sin datos de la petición). */
  private async peticion(
    metodo: Metodo,
    ruta: string,
    cuerpo: unknown,
    token: string | null,
    contexto: ContextoPeticion,
    { cancelar, params, archivo }: OpcionesPeticion = {},
  ): Promise<unknown> {
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    const url = `${this.base}/${ruta}`;
    const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
    const solicitud: Observable<unknown> = archivo
      ? this.http.get(url, { headers, params: httpParams, responseType: 'blob' })
      : metodo === 'GET'
        ? this.http.get<unknown>(url, { headers, params: httpParams })
        : this.http.post<unknown>(url, cuerpo ?? {}, { headers }); // FormData: el navegador pone el multipart
    try {
      // Cancelada antes de responder = sin conexión.
      return await firstValueFrom(cancelar ? solicitud.pipe(takeUntil(cancelar)) : solicitud);
    } catch (e) {
      if (e instanceof HttpErrorResponse) throw clasificarError(e.status, e.error, contexto);
      throw new ErrorApiOperador('sin-conexion', MENSAJES.sinConexion);
    }
  }
}
