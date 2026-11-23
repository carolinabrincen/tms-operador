import { ErrorApiOperador } from '../operador-api';
import { ReporteAvance } from '../operador-api.modelos';
import { OperadorApiEjemplo, OpcionesEjemplo } from './operador-api-ejemplo';

const CAMPOS_PROHIBIDOS = /tarifa|ingreso|costo|utilidad|pago|precio|importe|flete|monto|margen|sueldo|comision|comisión/i;

function crear(extra: Partial<OpcionesEjemplo> = {}) {
  let token: string | null = null;
  let enLinea = true;
  let ahora = new Date('2026-11-23T16:00:00Z');
  const api = new OperadorApiEjemplo({
    token: () => token,
    enLinea: () => enLinea,
    ahora: () => ahora,
    latenciaMs: 0,
    confirmarTrasMs: 20_000,
    ...extra,
  });
  return {
    api,
    entrar: async (celular = '8112345678') => (token = (await api.iniciarSesion(celular, '1234')).token),
    setToken: (t: string | null) => (token = t),
    setEnLinea: (v: boolean) => (enLinea = v),
    avanzar: (ms: number) => (ahora = new Date(ahora.getTime() + ms)),
  };
}

function reporte(extra: Partial<ReporteAvance> = {}): ReporteAvance {
  return {
    id: 'r-1',
    objetivo: { tipo: 'tramo', despachoId: 'ej-des-418', tramoId: 'ej-tra-2', viajeId: 'ej-via-771' },
    avance: 'llegue-cargar',
    ocurrioEn: '2026-11-23T16:00:00Z',
    ubicacion: null,
    nota: null,
    ...extra,
  };
}

async function errorDe(p: Promise<unknown>): Promise<ErrorApiOperador> {
  try {
    await p;
  } catch (e) {
    return e as ErrorApiOperador;
  }
  throw new Error('Se esperaba un error');
}

/** Todas las llaves (recursivo) de un objeto. */
function llaves(valor: unknown, acc: string[] = []): string[] {
  if (Array.isArray(valor)) valor.forEach((v) => llaves(v, acc));
  else if (valor && typeof valor === 'object') for (const [k, v] of Object.entries(valor)) acc.push(k), llaves(v, acc);
  return acc;
}

describe('OperadorApiEjemplo: implementación en memoria', () => {
  it('se identifica como ejemplo', () => {
    expect(crear().api.esEjemplo).toBe(true);
  });

  it('acceso: cualquier celular de 10 dígitos y PIN numérico entra; el resultado no trae el PIN', async () => {
    const { api } = crear();
    const s = await api.iniciarSesion('+52 81 1234 5678', '4321');
    expect(s).toEqual({ operadorId: 'ej-op-8112345678', nombre: 'Operador de ejemplo', celularTerminacion: '5678', token: 'ejemplo.ej-op-8112345678.0' });
    expect(JSON.stringify(s)).not.toContain('4321');
  });

  it('acceso inválido = error de sesión', async () => {
    const { api } = crear();
    expect((await errorDe(api.iniciarSesion('81123', '1234'))).tipo).toBe('sesion');
    expect((await errorDe(api.iniciarSesion('8112345678', 'abcd'))).tipo).toBe('sesion');
  });

  it('asignación: despacho con 4 tramos y un movimiento en vacío; sin sesión = error de sesión', async () => {
    const c = crear();
    expect((await errorDe(c.api.obtenerAsignacion())).tipo).toBe('sesion');
    await c.entrar();
    const a = await c.api.obtenerAsignacion();
    expect(a.despacho?.tramos.map((t) => t.tipo)).toEqual(['vacio', 'cargado', 'cargado', 'vacio']);
    expect(a.movimientosVacio.map((m) => m.motivo)).toEqual(['Carga de combustible']);
  });

  it('celular terminado en 0000: sin despacho activo', async () => {
    const c = crear();
    await c.entrar('8112340000');
    expect(await c.api.obtenerAsignacion()).toEqual({ despacho: null, movimientosVacio: [] });
  });

  it('los datos de ejemplo NO tienen tarifas, ingresos, costos, utilidad ni pagos', async () => {
    const c = crear();
    await c.entrar();
    const prohibidas = llaves(await c.api.obtenerAsignacion()).filter((k) => CAMPOS_PROHIBIDOS.test(k));
    expect(prohibidas).toEqual([]);
  });

  it('reenviar el mismo id NO duplica y devuelve el mismo acuse', async () => {
    const c = crear();
    await c.entrar();
    const a1 = await c.api.enviarReporte(reporte());
    const a2 = await c.api.enviarReporte(reporte());
    expect(c.api.totalRecibidos).toBe(1);
    expect(a2).toEqual(a1);
    await c.api.enviarReporte(reporte({ id: 'r-2' }));
    expect(c.api.totalRecibidos).toBe(2);
  });

  it('sin conexión: falla como sin-conexion y no registra nada', async () => {
    const c = crear();
    await c.entrar();
    c.setEnLinea(false);
    expect((await errorDe(c.api.enviarReporte(reporte()))).tipo).toBe('sin-conexion');
    expect(c.api.totalRecibidos).toBe(0);
  });

  it('rechaza reportes de tramos o movimientos ajenos, o con avance que no aplica', async () => {
    const c = crear();
    await c.entrar();
    const ajeno = reporte({ objetivo: { tipo: 'tramo', despachoId: 'ej-des-418', tramoId: 'otro', viajeId: null } });
    expect((await errorDe(c.api.enviarReporte(ajeno))).tipo).toBe('rechazado');
    const noAplica = reporte({ objetivo: { tipo: 'tramo', despachoId: 'ej-des-418', tramoId: 'ej-tra-1', viajeId: null }, avance: 'cargado' });
    expect((await errorDe(c.api.enviarReporte(noAplica))).tipo).toBe('rechazado');
    const mov = reporte({ objetivo: { tipo: 'movimiento', movimientoId: 'ej-mov-93' }, avance: 'llegue' });
    await expect(c.api.enviarReporte(mov)).resolves.toMatchObject({ id: 'r-1' });
    expect((await errorDe(c.api.enviarReporte({ ...mov, id: 'r-9', avance: 'entregado' }))).tipo).toBe('rechazado');
  });

  it('un reporte es de quien lo envió: otro operador no puede reenviarlo ni consultarlo', async () => {
    const c = crear();
    await c.entrar('8112345678');
    await c.api.enviarReporte(reporte());
    await c.entrar('8119999999');
    expect((await errorDe(c.api.enviarReporte(reporte()))).tipo).toBe('rechazado');
    expect(await c.api.consultarReportes(['r-1'])).toEqual([]);
  });

  it('la "oficina" confirma tras confirmarTrasMs; ids desconocidos no se devuelven', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(reporte());
    expect(await c.api.consultarReportes(['r-1', 'x'])).toEqual([{ id: 'r-1', confirmado: false, confirmadoEn: null }]);
    c.avanzar(20_000);
    expect(await c.api.consultarReportes(['r-1'])).toEqual([{ id: 'r-1', confirmado: true, confirmadoEn: '2026-11-23T16:00:20Z' }]);
    // Reenviar después de confirmado devuelve el acuse ya confirmado.
    expect((await c.api.enviarReporte(reporte())).confirmado).toBe(true);
  });
});
