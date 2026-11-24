import { CODIGO_HORA_INVALIDA } from '../operador-api';
import { CODIGO_CLAVE_DUPLICADA, CODIGO_SIN_ACCESO, MENSAJES, clasificarError } from './errores-api.util';

const pd = (status: number, codigo?: string, detail = 'Detalle del servidor') => ({ title: 'x', status, detail, ...(codigo ? { codigo } : {}) });

describe('errores-api.util: errores por status y código (contrato M1, tabla 3.2)', () => {
  it('sin respuesta (status 0): sin-conexion', () => {
    expect(clasificarError(0, null, 'general')).toMatchObject({ tipo: 'sin-conexion', message: MENSAJES.sinConexion });
  });

  it('400 OPERADOR_REPORTE_INVALIDO y DESPACHO_EVENTO_INVALIDO → rechazado, con el detail para mostrar', () => {
    for (const codigo of ['OPERADOR_REPORTE_INVALIDO', 'DESPACHO_EVENTO_INVALIDO']) {
      expect(clasificarError(400, pd(400, codigo, 'Otro exige nota.'), 'general')).toMatchObject({ tipo: 'rechazado', codigo, status: 400, message: 'Otro exige nota.' });
    }
  });

  it('400 DESPACHO_EVENTO_HORA_INVALIDA → rechazado con mensaje sobre el reloj del teléfono', () => {
    expect(clasificarError(400, pd(400, CODIGO_HORA_INVALIDA), 'general')).toMatchObject({ tipo: 'rechazado', codigo: CODIGO_HORA_INVALIDA, message: MENSAJES.horaInvalida });
  });

  it('404 OPERADOR_VIAJE_NO_ENCONTRADO y 409 OPERADOR_SALIDA_CERRADA → rechazado', () => {
    expect(clasificarError(404, pd(404, 'OPERADOR_VIAJE_NO_ENCONTRADO'), 'general').tipo).toBe('rechazado');
    expect(clasificarError(409, pd(409, 'OPERADOR_SALIDA_CERRADA'), 'general').tipo).toBe('rechazado');
  });

  it('409 DESPACHO_EVENTO_CLAVE_DUPLICADA → id-duplicado (generar otro id y reenviar)', () => {
    expect(clasificarError(409, pd(409, CODIGO_CLAVE_DUPLICADA), 'general')).toMatchObject({ tipo: 'id-duplicado', codigo: CODIGO_CLAVE_DUPLICADA });
  });

  it('403 OPERADOR_SIN_ACCESO → sesion (pedir PIN) con mensaje de acceso retirado', () => {
    expect(clasificarError(403, pd(403, CODIGO_SIN_ACCESO), 'general')).toMatchObject({ tipo: 'sesion', message: MENSAJES.sinAcceso });
  });

  it('401: en el acceso son credenciales; en lo demás, sesión terminada', () => {
    expect(clasificarError(401, pd(401), 'login')).toMatchObject({ tipo: 'sesion', message: MENSAJES.credenciales });
    expect(clasificarError(401, pd(401), 'renovar')).toMatchObject({ tipo: 'sesion', message: MENSAJES.sesionTerminada });
    expect(clasificarError(401, null, 'general')).toMatchObject({ tipo: 'sesion', message: MENSAJES.sesionTerminada });
  });

  it('429: en acceso y renovación "espere 15 minutos"; en lo demás se reintenta (no es rechazado)', () => {
    expect(clasificarError(429, pd(429), 'login')).toMatchObject({ tipo: 'limite', message: 'Demasiados intentos. Espere 15 minutos y vuelva a intentar.' });
    expect(clasificarError(429, pd(429), 'renovar').tipo).toBe('limite');
    expect(clasificarError(429, pd(429), 'general')).toMatchObject({ tipo: 'limite', message: MENSAJES.limite });
  });

  it('503 CUENTA_ESQUEMA_DESACTUALIZADO y 5xx → servidor (reintentar)', () => {
    expect(clasificarError(503, pd(503, 'CUENTA_ESQUEMA_DESACTUALIZADO'), 'general')).toMatchObject({ tipo: 'servidor', message: MENSAJES.mantenimiento });
    expect(clasificarError(500, null, 'general')).toMatchObject({ tipo: 'servidor', message: MENSAJES.servidor });
    expect(clasificarError(502, 'texto', 'general').tipo).toBe('servidor');
  });

  it('cuerpo raro o sin detail: mensaje propio; nunca se copia el cuerpo entero', () => {
    const e = clasificarError(400, { codigo: 'X', otro: 'token-secreto' }, 'general');
    expect(e.message).toBe(MENSAJES.rechazado);
    expect(JSON.stringify(e)).not.toContain('token-secreto');
  });
});
