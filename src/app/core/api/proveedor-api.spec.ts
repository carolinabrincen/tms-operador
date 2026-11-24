import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { OperadorApiEjemplo } from './ejemplo/operador-api-ejemplo';
import { OperadorApiHttp } from './http/operador-api-http';
import { OPERADOR_API } from './operador-api';
import { provideOperadorApi } from './proveedor-api';

describe('provideOperadorApi: se elige por configuración de entorno', () => {
  it('por omisión arranca con datos de ejemplo (hasta que Carolina diga lo contrario)', () => {
    expect(environment.fuenteDatos).toBe('ejemplo');
    TestBed.configureTestingModule({ providers: [provideOperadorApi()] });
    expect(TestBed.inject(OPERADOR_API)).toBeInstanceOf(OperadorApiEjemplo);
  });

  it("'api' usa la implementación real", () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideOperadorApi('api')] });
    const api = TestBed.inject(OPERADOR_API);
    expect(api).toBeInstanceOf(OperadorApiHttp);
    expect(api.esEjemplo).toBe(false);
  });
});
