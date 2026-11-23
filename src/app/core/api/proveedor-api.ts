import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AlmacenSesion } from '../sesion/almacen-sesion';
import { OperadorApiEjemplo } from './ejemplo/operador-api-ejemplo';
import { OPERADOR_API, OperadorApi } from './operador-api';

/**
 * Elige la implementación de OperadorApi según environment.fuenteDatos.
 * Cuando llegue el contrato: crear OperadorApiHttp (usa environment.apiUrl) y devolverla aquí para 'api'.
 */
export function provideOperadorApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: OPERADOR_API,
      useFactory: (): OperadorApi => {
        if (environment.fuenteDatos === 'ejemplo') {
          const almacen = inject(AlmacenSesion);
          return new OperadorApiEjemplo({ token: () => almacen.sesion()?.token ?? null });
        }
        throw new Error('La implementación real de la API del operador aún no existe: use fuenteDatos = "ejemplo".');
      },
    },
  ]);
}
