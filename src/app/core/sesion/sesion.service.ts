import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { normalizarCelular } from '../../shared/utils/acceso.util';
import { OPERADOR_API } from '../api/operador-api';
import { AsignacionService } from '../viaje/asignacion.service';
import { ColaReportesService } from '../reportes/cola-reportes.service';
import { AlmacenSesion } from './almacen-sesion';

/** Entrar y salir. El PIN solo pasa a la API; no se guarda en ningún lado. */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly api = inject(OPERADOR_API);
  private readonly almacen = inject(AlmacenSesion);
  private readonly cola = inject(ColaReportesService);
  private readonly asignacion = inject(AsignacionService);
  private readonly router = inject(Router);

  readonly sesion = this.almacen.sesion;

  /** Rechaza con ErrorApiOperador si no se pudo (credenciales, sin conexión…). */
  async entrar(celular: string, pin: string): Promise<void> {
    const sesion = await this.api.iniciarSesion(normalizarCelular(celular), pin);
    this.almacen.guardar(sesion);
    // Si quedaron reportes pendientes de este operador (de una sesión anterior), se envían ya.
    void this.cola.procesar();
  }

  /**
   * Cierra la sesión: borra token y refresh, la copia del viaje y el perfil. Los reportes pendientes se quedan en el
   * teléfono y se envían cuando ese operador vuelva a entrar.
   */
  async salir(): Promise<void> {
    try {
      await this.api.cerrarSesion();
    } catch {
      // Aunque falle el borrado, se sale igual (no hay nada que mostrar al operador).
    }
    this.asignacion.olvidar(this.almacen.operadorId());
    this.almacen.limpiar();
    await this.router.navigateByUrl('/acceso');
  }
}
