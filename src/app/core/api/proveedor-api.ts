import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AlmacenSesion } from '../sesion/almacen-sesion';
import { OperadorApiEjemplo } from './ejemplo/operador-api-ejemplo';
import { OperadorApiHttp } from './http/operador-api-http';
import { OPERADOR_API, OperadorApi } from './operador-api';

/**
 * Elige la implementación de OperadorApi según environment.fuenteDatos:
 *  - 'ejemplo' (por omisión): en memoria.
 *  - 'api': la API real (contrato M1) en environment.apiUrl. En desarrollo: `npm run start:api`.
 */
export function provideOperadorApi(fuente: 'ejemplo' | 'api' = environment.fuenteDatos): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: OPERADOR_API,
      useFactory: (): OperadorApi => {
        if (fuente === 'api') return new OperadorApiHttp();
        const almacen = inject(AlmacenSesion);
        return new OperadorApiEjemplo({ operadorId: () => almacen.operadorId() });
      },
    },
  ]);
}
