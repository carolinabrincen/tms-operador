import { ErrorApiOperador } from '../operador-api';
import { EstatusViaje, ReporteEstatus, ReporteIncidencia, Viaje } from '../operador-api.modelos';
import { OperadorApiEjemplo, OpcionesEjemplo } from './operador-api-ejemplo';

const CAMPOS_PROHIBIDOS = /tarifa|ingreso|costo|utilidad|pago|precio|importe|flete|monto|margen|sueldo|comision|comisión/i;
const CARGADO = 'ej-via-771';
const VACIO_PATIO = 'ej-via-770';
const VACIO_TALLER = 'ej-via-773';

function crear(extra: Partial<OpcionesEjemplo> = {}) {
  let token: string | null = null;
  let enLinea = true;
  let ahora = new Date('2026-11-23T16:00:00Z');
  const api = new OperadorApiEjemplo({
    token: () => token,
    enLinea: () => enLinea,
    ahora: () => ahora,
    latenciaMs: 0,
    confirmarHitoTrasMs: 20_000,
    oficinaAvanzaTrasMs: 30_000,
    cierreTrasMs: 30_000,
    ...extra,
  });
  const c = {
    api,
    entrar: async (celular = '8112345678') => (token = (await api.iniciarSesion(celular, '1234')).token),
    setEnLinea: (v: boolean) => (enLinea = v),
    avanzar: (ms: number) => (ahora = new Date(ahora.getTime() + ms)),
    viaje: async (id: string): Promise<Viaje> => (await api.obtenerAsignacion()).salida!.viajes.find((v) => v.id === id)!,
  };
  return c;
}

let n = 0;
function estatus(viajeId: string, e: EstatusViaje, id = `r${++n}`): ReporteEstatus {
  return { tipo: 'estatus', id, viajeId, estatus: e, ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null };
}
function incidencia(viajeId: string, extra: Partial<ReporteIncidencia> = {}): ReporteIncidencia {
  return { tipo: 'incidencia', id: `i${++n}`, viajeId, incidencia: 'FallaMecanica', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, ...extra };
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
    const s = await crear().api.iniciarSesion('+52 81 1234 5678', '4321');
    expect(s).toEqual({ operadorId: 'ej-op-8112345678', nombre: 'Operador de ejemplo', celularTerminacion: '5678', token: 'ejemplo.ej-op-8112345678.0' });
    expect(JSON.stringify(s)).not.toContain('4321');
  });

  it('acceso inválido = error de sesión', async () => {
    const { api } = crear();
    expect((await errorDe(api.iniciarSesion('81123', '1234'))).tipo).toBe('sesion');
    expect((await errorDe(api.iniciarSesion('8112345678', 'abcd'))).tipo).toBe('sesion');
  });

  it('asignación: salida con 4 viajes en orden (vacío, cargado, cargado, vacío), todos Asignado por la oficina', async () => {
    const c = crear();
    expect((await errorDe(c.api.obtenerAsignacion())).tipo).toBe('sesion');
    await c.entrar();
    const { salida } = await c.api.obtenerAsignacion();
    expect(salida!.viajes.map((v) => `${v.orden}:${v.tipo}:${v.estatus}`)).toEqual(['1:vacio:Asignado', '2:cargado:Asignado', '3:cargado:Asignado', '4:vacio:Asignado']);
    expect(salida!.viajes[0].historial).toEqual([{ tipo: 'estatus', estatus: 'Asignado', ocurrioEn: '2026-11-23T15:00:00Z', autor: 'oficina', reporteId: null }]);
  });

  it('celular terminado en 0000: sin salida', async () => {
    const c = crear();
    await c.entrar('8112340000');
    expect(await c.api.obtenerAsignacion()).toEqual({ salida: null });
  });

  it('los datos de ejemplo NO tienen tarifas, ingresos, costos, utilidad ni pagos', async () => {
    const c = crear();
    await c.entrar();
    expect(llaves(await c.api.obtenerAsignacion()).filter((k) => CAMPOS_PROHIBIDOS.test(k))).toEqual([]);
  });

  it('intermedio: se aplica al momento y queda en el historial como del operador', async () => {
    const c = crear();
    await c.entrar();
    const r = estatus(CARGADO, 'EnPatioOrigen'); // salta "Voy a cargar": se vale
    expect(await c.api.enviarReporte(r)).toMatchObject({ resultado: 'aplicado', mensaje: null });
    const v = await c.viaje(CARGADO);
    expect(v.estatus).toBe('EnPatioOrigen');
    expect(v.historial.at(-1)).toEqual({ tipo: 'estatus', estatus: 'EnPatioOrigen', ocurrioEn: r.ocurrioEn, autor: 'operador', reporteId: r.id });
  });

  it('hito: queda por confirmar y la oficina lo confirma después de un rato', async () => {
    const c = crear();
    await c.entrar();
    const r = estatus(CARGADO, 'Documentado');
    expect((await c.api.enviarReporte(r)).resultado).toBe('por-confirmar');
    expect((await c.viaje(CARGADO)).estatus).toBe('Asignado');
    expect(await c.api.consultarReportes([r.id])).toEqual([{ id: r.id, resultado: 'por-confirmar', confirmadoEn: null }]);
    c.avanzar(20_000);
    expect(await c.api.consultarReportes([r.id])).toEqual([{ id: r.id, resultado: 'confirmado', confirmadoEn: '2026-11-23T16:00:20Z' }]);
    expect((await c.viaje(CARGADO)).estatus).toBe('Documentado');
  });

  it('el hito confirmado queda en el historial aunque el operador ya haya avanzado', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'Documentado'));
    await c.api.enviarReporte(estatus(CARGADO, 'EnTransito'));
    c.avanzar(20_000);
    const v = await c.viaje(CARGADO);
    expect(v.estatus).toBe('EnTransito');
    expect(v.historial.filter((e) => e.tipo === 'estatus').map((e) => (e as { estatus: string }).estatus)).toContain('Documentado');
  });

  it('la oficina avanza sola: tras "EnCarga" pone Documentado ella misma', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'EnCarga'));
    c.avanzar(29_000);
    expect((await c.viaje(CARGADO)).estatus).toBe('EnCarga');
    c.avanzar(1_000);
    const v = await c.viaje(CARGADO);
    expect(v.estatus).toBe('Documentado');
    expect(v.historial.at(-1)).toMatchObject({ estatus: 'Documentado', autor: 'oficina', reporteId: null, ocurrioEn: '2026-11-23T16:00:30Z' });
  });

  it('si el operador reporta un paso que la oficina ya rebasó: se recibe "sin efecto" y no retrocede', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'EnCarga'));
    c.avanzar(30_000); // oficina → Documentado
    const atrasado = await c.api.enviarReporte(estatus(CARGADO, 'EnPatioOrigen'));
    expect(atrasado.resultado).toBe('sin-efecto');
    expect(atrasado.mensaje).toBe('El viaje ya estaba en «Documentado». Su reporte quedó registrado sin cambiar el estatus.');
    expect((await c.viaje(CARGADO)).estatus).toBe('Documentado');
  });

  it('si el operador ya reportó Documentado, la oficina no lo pone por su cuenta', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'EnCarga'));
    await c.api.enviarReporte(estatus(CARGADO, 'Documentado'));
    c.avanzar(30_000);
    const docs = (await c.viaje(CARGADO)).historial.filter((e) => e.tipo === 'estatus' && e.estatus === 'Documentado');
    expect(docs.map((e) => e.autor)).toEqual(['operador']);
  });

  it('Descargado confirmado → la oficina cierra el viaje después', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'Descargado'));
    c.avanzar(20_000);
    expect((await c.viaje(CARGADO)).estatus).toBe('Descargado');
    c.avanzar(30_000);
    expect((await c.viaje(CARGADO)).estatus).toBe('Cerrado');
  });

  it('vacío: Salí → EnTransitoVacio; Llegué → EnPatio o EnTaller según el último tramo; después la oficina cierra', async () => {
    const c = crear();
    await c.entrar();
    expect((await c.api.enviarReporte(estatus(VACIO_PATIO, 'EnTransitoVacio'))).resultado).toBe('aplicado');
    expect((await errorDe(c.api.enviarReporte(estatus(VACIO_PATIO, 'EnTaller')))).tipo).toBe('rechazado');
    expect((await c.api.enviarReporte(estatus(VACIO_PATIO, 'EnPatio'))).resultado).toBe('aplicado');
    expect((await errorDe(c.api.enviarReporte(estatus(VACIO_TALLER, 'EnPatio')))).tipo).toBe('rechazado');
    expect((await c.api.enviarReporte(estatus(VACIO_TALLER, 'EnTaller'))).resultado).toBe('aplicado');
    c.avanzar(30_000);
    expect((await c.viaje(VACIO_PATIO)).estatus).toBe('Cerrado');
    expect((await c.viaje(VACIO_TALLER)).estatus).toBe('Cerrado');
  });

  it('rechaza Asignado, Cerrado, estatus de otro tipo de viaje y viajes ajenos', async () => {
    const c = crear();
    await c.entrar();
    for (const e of ['Asignado', 'Cerrado', 'EnTransitoVacio'] as const) {
      expect((await errorDe(c.api.enviarReporte(estatus(CARGADO, e)))).tipo).toBe('rechazado');
    }
    expect((await errorDe(c.api.enviarReporte(estatus('otro-viaje', 'EnCarga')))).message).toBe('Ese viaje no está asignado a usted.');
  });

  it('incidencia: se registra en el historial y NO cambia el estatus; en "Otro" la nota es obligatoria', async () => {
    const c = crear();
    await c.entrar();
    const i = incidencia(CARGADO, { incidencia: 'RetenInspeccion', nota: 'Revisión' });
    expect((await c.api.enviarReporte(i)).resultado).toBe('registrado');
    const v = await c.viaje(CARGADO);
    expect(v.estatus).toBe('Asignado');
    expect(v.historial.at(-1)).toEqual({ tipo: 'incidencia', incidencia: 'RetenInspeccion', nota: 'Revisión', ocurrioEn: i.ocurrioEn, autor: 'operador', reporteId: i.id });
    expect((await errorDe(c.api.enviarReporte(incidencia(CARGADO, { incidencia: 'Otro', nota: ' ' })))).tipo).toBe('rechazado');
    expect((await c.api.enviarReporte(incidencia(CARGADO, { incidencia: 'Otro', nota: 'Lluvia' }))).resultado).toBe('registrado');
  });

  it('incidencia en viaje cerrado: rechazada', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(VACIO_PATIO, 'EnPatio'));
    c.avanzar(30_000);
    expect((await errorDe(c.api.enviarReporte(incidencia(VACIO_PATIO)))).message).toBe('El viaje ya está cerrado.');
  });

  it('reenviar el mismo id NO duplica y devuelve el resultado actual', async () => {
    const c = crear();
    await c.entrar();
    const r = estatus(CARGADO, 'Documentado');
    const a1 = await c.api.enviarReporte(r);
    expect(await c.api.enviarReporte(r)).toEqual(a1);
    expect(c.api.totalRecibidos).toBe(1);
    c.avanzar(20_000);
    expect((await c.api.enviarReporte(r)).resultado).toBe('confirmado');
    expect(c.api.totalRecibidos).toBe(1);
    expect((await c.viaje(CARGADO)).historial.filter((e) => e.reporteId === r.id)).toHaveLength(1);
  });

  it('sin conexión: falla como sin-conexion y no registra nada', async () => {
    const c = crear();
    await c.entrar();
    c.setEnLinea(false);
    expect((await errorDe(c.api.enviarReporte(estatus(CARGADO, 'EnCarga')))).tipo).toBe('sin-conexion');
    expect(c.api.totalRecibidos).toBe(0);
  });

  it('cada operador tiene su propia salida y sus reportes', async () => {
    const c = crear();
    await c.entrar('8112345678');
    const r = estatus(CARGADO, 'EnCarga');
    await c.api.enviarReporte(r);
    await c.entrar('8119999999');
    expect((await c.viaje(CARGADO)).estatus).toBe('Asignado');
    expect((await errorDe(c.api.enviarReporte(r))).tipo).toBe('rechazado');
    expect(await c.api.consultarReportes([r.id])).toEqual([]);
  });
});
