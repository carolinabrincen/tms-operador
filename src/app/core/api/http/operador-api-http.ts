import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NAVEGADOR } from '../../plataforma';
import { ALMACEN_CREDENCIALES } from '../../sesion/almacen-credenciales';
import { ErrorApiOperador, OperadorApi } from '../operador-api';
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

/** Base de la API (la misma de la oficina, con /api). Las rutas del operador cuelgan de `${base}/operador`. */
export const API_URL = new InjectionToken<string>('API_URL', { providedIn: 'root', factory: () => environment.apiUrl });

/** Nombre del Web Lock que serializa la renovación entre pestañas. */
export const NOMBRE_LOCK_RENOVACION = 'ct-operador-renovar';

type Metodo = 'GET' | 'POST';

/**
 * Implementación REAL de OperadorApi (contrato M1).
 *
 * Sesión:
 *  - Login y renovación guardan token y refresh en IndexedDB (AlmacenCredenciales). Nunca salen de aquí: no se
 *    imprimen, no van en mensajes de error y las pantallas no los ven.
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

  async cerrarSesion(): Promise<void> {
    await this.almacen.borrar();
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

  // ------------------------------------------------------------------ internos

  /** Petición con token. 401 → renovar una vez y repetir; si vuelve el 401, 'sesion'. */
  private async autorizada(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<unknown> {
    const guardadas = await this.almacen.leer();
    // Sin token (p. ej. se perdió): se intenta con el refresh antes de molestar al operador.
    const credenciales = guardadas ?? (await this.renovar(null));
    try {
      return await this.peticion(metodo, ruta, cuerpo, credenciales.token, 'general');
    } catch (e) {
      if (!(e instanceof ErrorApiOperador) || e.status !== 401) throw e;
    }
    const nuevas = await this.renovar(credenciales.token);
    return this.peticion(metodo, ruta, cuerpo, nuevas.token, 'general');
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
  private async peticion(metodo: Metodo, ruta: string, cuerpo: unknown, token: string | null, contexto: ContextoPeticion): Promise<unknown> {
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    const url = `${this.base}/${ruta}`;
    try {
      return await firstValueFrom(
        metodo === 'GET' ? this.http.get<unknown>(url, { headers }) : this.http.post<unknown>(url, cuerpo ?? {}, { headers }),
      );
    } catch (e) {
      if (e instanceof HttpErrorResponse) throw clasificarError(e.status, e.error, contexto);
      throw new ErrorApiOperador('sin-conexion', MENSAJES.sinConexion);
    }
  }
}
