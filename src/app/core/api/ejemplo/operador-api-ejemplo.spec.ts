import { ErrorApiOperador } from '../operador-api';
import { DatosEvidencia } from '../operador-api-m2.modelos';
import { fotoJpeg } from '../../../testing/entorno-pruebas';
import { EstatusViaje, ReporteEstatus, ReporteIncidencia, TerminoIncidencia, Viaje } from '../operador-api.modelos';
import { OperadorApiEjemplo, OpcionesEjemplo } from './operador-api-ejemplo';

const CAMPOS_PROHIBIDOS = /tarifa|ingreso|costo|utilidad|pago|precio|importe|flete|monto|margen|sueldo|comision|comisión/i;
const CARGADO = 'ej-via-771';
const VACIO_PATIO = 'ej-via-770';
const VACIO_TALLER = 'ej-via-773';

function crear(extra: Partial<OpcionesEjemplo> = {}) {
  let operadorId: string | null = null;
  let enLinea = true;
  let ahora = new Date('2026-11-23T16:00:00Z');
  const api = new OperadorApiEjemplo({
    operadorId: () => operadorId,
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
    entrar: async (celular = '8112345678') => (operadorId = (await api.iniciarSesion(celular, '123456')).operadorId),
    salir: () => (operadorId = null),
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
  return { tipo: 'incidencia', id: `i${++n}`, viajeId, incidencia: 'IncidenciaMecanica', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null, ...extra };
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

  it('acceso: cualquier celular de 10 dígitos y PIN de 6 dígitos entra; devuelve solo el perfil (sin PIN ni token)', async () => {
    const s = await crear().api.iniciarSesion('+52 81 1234 5678', '482915');
    expect(s).toEqual({ operadorId: 'ej-op-8112345678', nombre: 'Operador de ejemplo', celularTerminacion: '5678' });
    expect(JSON.stringify(s)).not.toContain('482915');
  });

  it('acceso inválido = error de sesión', async () => {
    const { api } = crear();
    expect((await errorDe(api.iniciarSesion('81123', '123456'))).tipo).toBe('sesion');
    expect((await errorDe(api.iniciarSesion('8112345678', '1234'))).tipo).toBe('sesion');
    expect((await errorDe(api.iniciarSesion('8112345678', 'abcd'))).tipo).toBe('sesion');
  });

  it('asignación: salida con 4 viajes en orden (vacío, cargado, cargado, vacío), todos Asignado por la oficina', async () => {
    const c = crear();
    expect((await errorDe(c.api.obtenerAsignacion())).tipo).toBe('sesion');
    await c.entrar();
    const { salida } = await c.api.obtenerAsignacion();
    expect(salida!.viajes.map((v) => `${v.orden}:${v.tipo}:${v.estatus}`)).toEqual(['1:vacio:Asignado', '2:cargado:Asignado', '3:cargado:Asignado', '4:vacio:Asignado']);
    expect(salida!.viajes[0].historial).toEqual([
      { tipo: 'estatus', estatus: 'Asignado', nota: null, ocurrioEn: '2026-11-23T15:00:00Z', autor: 'oficina', reporteId: null },
      // La incidencia que registró la oficina (sigue abierta: ver incidenciasAbiertas).
      { tipo: 'incidencia', incidencia: 'RetenOInspeccion', nota: 'Revisión de documentos a la salida del patio', ocurrioEn: '2026-11-23T15:20:00Z', autor: 'oficina', reporteId: null },
    ]);
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
    expect(v.historial.at(-1)).toEqual({ tipo: 'estatus', estatus: 'EnPatioOrigen', nota: null, ocurrioEn: r.ocurrioEn, autor: 'operador', reporteId: r.id });
  });

  it('hito: queda por confirmar y la oficina lo confirma después de un rato', async () => {
    const c = crear();
    await c.entrar();
    const r = estatus(CARGADO, 'Documentado');
    expect(await c.api.enviarReporte(r)).toMatchObject({ resultado: 'por-confirmar', mensaje: 'Recibido; la oficina lo confirma.' });
    expect((await c.viaje(CARGADO)).estatus).toBe('Asignado');
    expect(await c.api.consultarReportes([r.id])).toEqual([{ id: r.id, resultado: 'por-confirmar', confirmadoEn: null, mensaje: 'Recibido; la oficina lo confirma.' }]);
    c.avanzar(20_000);
    expect(await c.api.consultarReportes([r.id])).toEqual([{ id: r.id, resultado: 'confirmado', confirmadoEn: '2026-11-23T16:00:20Z', mensaje: null }]);
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
    expect(atrasado.mensaje).toBe('La oficina ya registró Documentado; el estatus no cambió.');
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
    const i = incidencia(CARGADO, { incidencia: 'RetenOInspeccion', nota: 'Revisión' });
    expect((await c.api.enviarReporte(i)).resultado).toBe('registrado');
    const v = await c.viaje(CARGADO);
    expect(v.estatus).toBe('Asignado');
    expect(v.historial.at(-1)).toEqual({ tipo: 'incidencia', incidencia: 'RetenOInspeccion', nota: 'Revisión', ocurrioEn: i.ocurrioEn, autor: 'operador', reporteId: i.id });
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

  it('renovar: funciona con operador en sesión; sin él, error de sesión. Cerrar sesión no falla', async () => {
    const c = crear();
    expect((await errorDe(c.api.renovarSesion())).tipo).toBe('sesion');
    await c.entrar();
    await expect(c.api.renovarSesion()).resolves.toBeUndefined();
    await expect(c.api.cerrarSesion()).resolves.toBeUndefined();
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

  it('la oficina anula un hito confirmado: el reporte queda "sin efecto" con mensaje legible, sale del historial y el viaje vuelve atrás', async () => {
    const c = crear();
    const op = await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'EnCarga'));
    const doc = estatus(CARGADO, 'Documentado');
    await c.api.enviarReporte(doc);
    c.avanzar(20_000);
    expect((await c.viaje(CARGADO)).estatus).toBe('Documentado');
    expect(c.api.anularHito(op, CARGADO, 'Descargado', 'x')).toBe(false); // no hay tal hito confirmado
    expect(c.api.anularHito(op, CARGADO, 'Documentado', 'faltó la carta porte')).toBe(true);
    const mensaje = 'La oficina anuló el estatus Documentado: faltó la carta porte. Puedes volver a reportarlo.';
    expect(await c.api.consultarReportes([doc.id])).toEqual([{ id: doc.id, resultado: 'sin-efecto', confirmadoEn: null, mensaje }]);
    expect(await c.api.enviarReporte(doc)).toMatchObject({ resultado: 'sin-efecto', mensaje }); // reenviar el mismo id: igual
    const v = await c.viaje(CARGADO);
    expect(v.estatus).toBe('EnCarga');
    expect(v.historial.some((e) => e.reporteId === doc.id)).toBe(false);
    // Se puede reportar otra vez, con otro id: queda por confirmar.
    expect((await c.api.enviarReporte(estatus(CARGADO, 'Documentado'))).resultado).toBe('por-confirmar');
  });

  it('la oficina cierra la salida: asignación sin salida; un reporte tardío queda como historial ("sin efecto")', async () => {
    const c = crear();
    const op = await c.entrar();
    expect((await c.api.obtenerAsignacion()).salida).not.toBeNull();
    c.api.cerrarSalida(op);
    expect(await c.api.obtenerAsignacion()).toEqual({ salida: null });
    expect(await c.api.enviarReporte(estatus(CARGADO, 'EnCarga'))).toMatchObject({
      resultado: 'sin-efecto',
      mensaje: 'La salida SAL-2026-00418 ya estaba cerrada; quedó como historial.',
    });
  });

  it('los mensajes van legibles, nunca con el valor técnico del estatus', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'EnTransito'));
    const atrasado = await c.api.enviarReporte(estatus(CARGADO, 'EnCarga'));
    expect(atrasado.mensaje).toBe('La oficina ya registró En tránsito; el estatus no cambió.');
    expect(atrasado.mensaje).not.toContain('EnTransito');
  });
});

describe('OperadorApiEjemplo M2: hoja de ruta y evidencias', () => {
  const datos = (id: string, extra: Partial<DatosEvidencia> = {}): DatosEvidencia => ({
    id,
    viajeId: CARGADO,
    tipo: 'Sellos',
    descripcion: null,
    nota: null,
    reporteId: null,
    tomadaEn: null,
    ubicacion: null,
    ...extra,
  });

  it('hoja de ruta de la salida: 4 tramos en orden, teléfonos, ligaMapa https, material peligroso; sin salida: null', async () => {
    const c = crear();
    await c.entrar();
    const h = (await c.api.obtenerHojaRuta())!;
    expect(h.folio).toBe('SAL-2026-00418');
    expect(h.itinerario.map((t) => `${t.orden}:${t.tipo}`)).toEqual(['1:vacio', '2:cargado', '3:cargado', '4:vacio']);
    expect(h.telefonoTrafico).toBeTruthy();
    expect(h.itinerario[1].ruta!.ligaMapa).toMatch(/^https:\/\//);
    expect(h.itinerario[2].materialPeligroso).toBe(true);
    await c.entrar('8112340000');
    expect(await c.api.obtenerHojaRuta()).toBeNull();
  });

  it('GUARDA DE DINERO: la hoja de ruta y las evidencias de ejemplo no tienen tarifas, importes, casetas en pesos, diésel ni pagos', async () => {
    const c = crear();
    await c.entrar();
    const PROHIBIDOS = new RegExp(`${CAMPOS_PROHIBIDOS.source}|pesos|diesel|diésel`, 'i');
    const hoja = await c.api.obtenerHojaRuta();
    expect(llaves(hoja).filter((k) => PROHIBIDOS.test(k))).toEqual([]);
    await c.api.subirEvidencia(fotoJpeg(1), datos('e1'));
    const lista = await c.api.evidenciasDeViaje(CARGADO);
    expect(llaves(lista).filter((k) => PROHIBIDOS.test(k))).toEqual([]);
    expect(llaves(await c.api.consultarEvidencias(['e1'])).filter((k) => PROHIBIDOS.test(k))).toEqual([]);
  });

  it('subir: acuse con mensaje; reintento con el mismo id y la misma foto = mismo acuse, sin otra copia', async () => {
    const c = crear();
    await c.entrar();
    const a1 = await c.api.subirEvidencia(fotoJpeg(1), datos('e1', { tipo: 'AcuseRecibido' }));
    expect(a1).toEqual({ id: 'e1', recibidaEn: '2026-11-23T16:00:00Z', mensaje: 'Recibida: Acuse de recibido.' });
    c.avanzar(60_000);
    expect(await c.api.subirEvidencia(fotoJpeg(1), datos('e1', { tipo: 'AcuseRecibido' }))).toEqual(a1);
    expect((await c.api.evidenciasDeViaje(CARGADO)).filter((e) => e.autor === 'operador')).toHaveLength(1);
  });

  it('el mismo id con OTRA foto: 409 VIAJE_EVIDENCIA_CLAVE_DUPLICADA (id-duplicado)', async () => {
    const c = crear();
    await c.entrar();
    await c.api.subirEvidencia(fotoJpeg(1), datos('e1'));
    expect(await errorDe(c.api.subirEvidencia(fotoJpeg(2), datos('e1')))).toMatchObject({ tipo: 'id-duplicado', codigo: 'VIAJE_EVIDENCIA_CLAVE_DUPLICADA', status: 409 });
  });

  it('reglas del contrato: vacío, viaje ajeno, Otro sin descripción, no JPG/PNG, más de 5 MB, 30 por viaje', async () => {
    const c = crear();
    await c.entrar();
    const codigo = async (p: Promise<unknown>) => (await errorDe(p)).codigo;
    expect(await codigo(c.api.subirEvidencia(fotoJpeg(), datos('x1', { viajeId: VACIO_PATIO })))).toBe('VIAJE_EVIDENCIA_INVALIDA');
    expect(await codigo(c.api.subirEvidencia(fotoJpeg(), datos('x2', { viajeId: 'ajeno' })))).toBe('OPERADOR_VIAJE_NO_ENCONTRADO');
    expect(await codigo(c.api.subirEvidencia(fotoJpeg(), datos('x3', { tipo: 'Otro' })))).toBe('VIAJE_EVIDENCIA_INVALIDA');
    expect(await codigo(c.api.subirEvidencia(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), datos('x4')))).toBe('VIAJE_EVIDENCIA_ARCHIVO_INVALIDO');
    expect(await codigo(c.api.subirEvidencia(fotoJpeg(1, 5 * 1024 * 1024 + 1), datos('x5')))).toBe('VIAJE_EVIDENCIA_DEMASIADO_GRANDE');
    // La de la oficina también cuenta como vigente: con 29 del operador ya son 30.
    for (let i = 0; i < 29; i++) await c.api.subirEvidencia(fotoJpeg(i), datos(`ok${i}`));
    expect(await codigo(c.api.subirEvidencia(fotoJpeg(99), datos('x6')))).toBe('VIAJE_EVIDENCIA_LIMITE');
  });

  it('galería: las suyas y las de la oficina; el archivo de la oficina, anulada o ajena = null (404), no error', async () => {
    const c = crear();
    await c.entrar();
    await c.api.subirEvidencia(fotoJpeg(3), datos('e1'));
    const lista = await c.api.evidenciasDeViaje(CARGADO);
    expect(lista.map((e) => `${e.autor}:${e.tipo}`).sort()).toEqual(['oficina:CartaPorteFirmada', 'operador:Sellos']);
    const archivo = await c.api.archivoEvidencia('e1');
    expect(archivo!.type).toBe('image/jpeg');
    expect(archivo!.size).toBe(64);
    expect(await c.api.archivoEvidencia('ej-evi-oficina-1')).toBeNull();
    c.api.anularEvidencia('e1', 'borrosa');
    expect(await c.api.archivoEvidencia('e1')).toBeNull();
    expect(await c.api.consultarEvidencias(['e1', 'no-llego'])).toEqual([{ id: 'e1', estado: 'anulada', motivo: 'La oficina anuló la evidencia: borrosa' }]);
    expect((await c.api.evidenciasDeViaje(CARGADO)).map((e) => e.autor)).toEqual(['oficina']);
  });
});

describe('OperadorApiEjemplo: incidencias abiertas y "Ya continué" (secciones 2 y 7)', () => {
  const OFICINA = 'ej-inc-oficina-1';
  const termino = (id: string, incidenciaId = OFICINA, terminadaEn = '2026-11-23T16:00:00Z'): TerminoIncidencia => ({
    tipo: 'termino',
    id,
    incidenciaId,
    terminadaEn,
    ubicacion: null,
    nota: null,
  });

  it('la asignación trae la incidencia abierta de la oficina, solo con id, tipo, ocurrioEn y nota', async () => {
    const c = crear();
    await c.entrar();
    const { salida } = await c.api.obtenerAsignacion();
    expect(salida!.incidenciasAbiertas).toEqual([
      { id: OFICINA, tipo: 'RetenOInspeccion', ocurrioEn: '2026-11-23T15:20:00Z', nota: 'Revisión de documentos a la salida del patio' },
    ]);
  });

  it('GUARDA DE DINERO: las incidencias abiertas y el acuse del término no tienen tarifas, importes ni pagos', async () => {
    const c = crear();
    await c.entrar();
    expect(llaves((await c.api.obtenerAsignacion()).salida!.incidenciasAbiertas).filter((k) => CAMPOS_PROHIBIDOS.test(k))).toEqual([]);
    expect(llaves(await c.api.terminarIncidencia(termino('t1'))).filter((k) => CAMPOS_PROHIBIDOS.test(k))).toEqual([]);
  });

  it('"Ya continué": terminada al momento y sale de abiertas; reenviar el mismo id da el mismo acuse sin cambiar nada', async () => {
    const c = crear();
    await c.entrar();
    const a1 = await c.api.terminarIncidencia(termino('t1'));
    expect(a1).toEqual({ id: 't1', incidenciaId: OFICINA, recibidoEn: '2026-11-23T16:00:00Z', terminadaEn: '2026-11-23T16:00:00Z', resultado: 'terminada', mensaje: null });
    expect((await c.api.obtenerAsignacion()).salida!.incidenciasAbiertas).toEqual([]);
    c.avanzar(60_000);
    expect(await c.api.terminarIncidencia(termino('t1'))).toEqual(a1);
  });

  it('ya terminada: por usted con otro id, por un estatus nuevo o por la oficina (mensaje de usted, sin error)', async () => {
    const c = crear();
    const op = await c.entrar();
    await c.api.terminarIncidencia(termino('t1'));
    expect(await c.api.terminarIncidencia(termino('t2'))).toMatchObject({
      resultado: 'ya-terminada',
      terminadaEn: '2026-11-23T16:00:00Z',
      mensaje: 'Usted ya había terminado la incidencia Retén o inspección.',
    });

    const c2 = crear();
    await c2.entrar();
    await c2.api.enviarReporte(estatus(VACIO_PATIO, 'EnTransitoVacio')); // término automático
    expect((await c2.api.obtenerAsignacion()).salida!.incidenciasAbiertas).toEqual([]);
    expect(await c2.api.terminarIncidencia(termino('t3'))).toMatchObject({
      resultado: 'ya-terminada',
      mensaje: 'La incidencia Retén o inspección ya había terminado al registrarse un estatus.',
    });

    const c3 = crear();
    const op3 = await c3.entrar();
    await c3.api.obtenerAsignacion();
    expect(c3.api.terminarIncidenciaPorOficina(op3, OFICINA)).toBe(true);
    expect(await c3.api.terminarIncidencia(termino('t4'))).toMatchObject({ resultado: 'ya-terminada', mensaje: 'La oficina ya había terminado la incidencia Retén o inspección.' });
    expect(op).toBeTruthy();
  });

  it('un estatus de OTRO viaje no termina la incidencia de este viaje', async () => {
    const c = crear();
    await c.entrar();
    await c.api.enviarReporte(estatus(CARGADO, 'EnPosicionamiento'));
    expect((await c.api.obtenerAsignacion()).salida!.incidenciasAbiertas.map((i) => i.id)).toEqual([OFICINA]);
  });

  it('una incidencia reportada desde la app queda abierta hasta "Ya continué"', async () => {
    const c = crear();
    await c.entrar();
    const r = incidencia(CARGADO, { incidencia: 'DetenidoEnParador', ocurrioEn: '2026-11-23T15:50:00Z', nota: 'Parador km 40' });
    await c.api.enviarReporte(r);
    const abiertas = (await c.api.obtenerAsignacion()).salida!.incidenciasAbiertas;
    expect(abiertas.map((i) => i.tipo)).toEqual(['RetenOInspeccion', 'DetenidoEnParador']); // de la más antigua a la más reciente
    expect(abiertas[1]).toMatchObject({ ocurrioEn: '2026-11-23T15:50:00Z', nota: 'Parador km 40' });
    await c.api.terminarIncidencia(termino('t1', abiertas[1].id));
    expect((await c.api.obtenerAsignacion()).salida!.incidenciasAbiertas.map((i) => i.id)).toEqual([OFICINA]);
  });

  it('errores de la sección 7: no encontrada (404), hora antes del hecho (400), salida cerrada (409), id de otro operador (409)', async () => {
    const c = crear();
    const op = await c.entrar();
    expect(await errorDe(c.api.terminarIncidencia(termino('x1', 'no-existe')))).toMatchObject({ tipo: 'rechazado', codigo: 'OPERADOR_INCIDENCIA_NO_ENCONTRADA', status: 404 });
    expect(await errorDe(c.api.terminarIncidencia(termino('x2', OFICINA, '2026-11-23T15:00:00Z')))).toMatchObject({ codigo: 'DESPACHO_EVENTO_HORA_INVALIDA', status: 400 });
    await c.api.terminarIncidencia(termino('mio'));
    await c.entrar('8119999999');
    expect(await errorDe(c.api.terminarIncidencia(termino('mio')))).toMatchObject({ tipo: 'id-duplicado', codigo: 'DESPACHO_EVENTO_CLAVE_DUPLICADA', status: 409 });
    const c2 = crear();
    const op2 = await c2.entrar();
    await c2.api.obtenerAsignacion();
    c2.api.cerrarSalida(op2);
    expect(await errorDe(c2.api.terminarIncidencia(termino('x3')))).toMatchObject({ tipo: 'rechazado', codigo: 'OPERADOR_SALIDA_CERRADA', status: 409 });
    expect(op).toBeTruthy();
  });
});
