import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NAVEGADOR, NavegadorMinimo } from '../../plataforma';
import { ALMACEN_CREDENCIALES, AlmacenCredencialesMemoria } from '../../sesion/almacen-credenciales';
import { SALIDA_CARGADA, SALIDA_VACIA, SESION_API } from '../../../testing/respuestas-api';
import { CODIGO_HORA_INVALIDA, ErrorApiOperador } from '../operador-api';
import { ReporteOperador } from '../operador-api.modelos';
import { CODIGO_CLAVE_DUPLICADA, CODIGO_SIN_ACCESO, MENSAJES } from './errores-api.util';
import { Credenciales } from './mapeo-api.util';
import { API_URL, ESPERA_CIERRE_SESION_MS, NOMBRE_LOCK_RENOVACION, OperadorApiHttp } from './operador-api-http';

const BASE = 'https://api.prueba/api/operador';
const CRED_1: Credenciales = { token: 'token-1', expiraEn: '2026-11-23T21:05:00Z', refreshToken: 'refresh-1', refreshExpiraEn: '2026-12-23T20:05:00Z' };
const RENOVADA = { ...SESION_API, token: 'token-2', refreshToken: 'refresh-2' };

const REPORTE: ReporteOperador = {
  tipo: 'estatus',
  id: '11111111-2222-4333-8444-555555555555',
  viajeId: 'via-1',
  estatus: 'EnPatioOrigen',
  ocurrioEn: '2026-11-23T20:05:00Z',
  ubicacion: { lat: 19.4326, lng: -99.1332, precisionM: 12.5, tomadoEn: '2026-11-23T20:04:58Z' },
  nota: null,
};

describe('OperadorApiHttp: la API real según el contrato M1', () => {
  let api: OperadorApiHttp;
  let http: HttpTestingController;
  let almacen: AlmacenCredencialesMemoria;
  let navegador: NavegadorMinimo;

  function configurar(nav: NavegadorMinimo = { onLine: true }) {
    almacen = new AlmacenCredencialesMemoria();
    navegador = nav;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: 'https://api.prueba/api/' },
        { provide: ALMACEN_CREDENCIALES, useValue: almacen },
        { provide: NAVEGADOR, useValue: navegador },
        { provide: ESPERA_CIERRE_SESION_MS, useValue: 200 },
      ],
    });
    api = TestBed.runInInjectionContext(() => new OperadorApiHttp());
    http = TestBed.inject(HttpTestingController);
  }

  /** Espera la petición (llega después de leer las credenciales, de forma asíncrona). */
  async function pedido(method: 'GET' | 'POST', ruta: string): Promise<TestRequest> {
    let req!: TestRequest;
    await vi.waitFor(() => {
      req = http.expectOne({ method, url: `${BASE}/${ruta}` });
    });
    return req;
  }

  const falla = (req: TestRequest, status: number, codigo?: string, detail = 'Detalle') =>
    req.flush({ title: 't', status, detail, ...(codigo ? { codigo } : {}) }, { status, statusText: 'x' });

  async function errorDe(p: Promise<unknown>): Promise<ErrorApiOperador> {
    try {
      await p;
    } catch (e) {
      return e as ErrorApiOperador;
    }
    throw new Error('Se esperaba un error');
  }

  beforeEach(() => configurar());
  afterEach(() => http.verify());

  // ------------------------------------------------------------------ sesión

  it('no es la de ejemplo', () => {
    expect(api.esEjemplo).toBe(false);
  });

  it('login: POST sesion con celular y PIN, sin token; guarda token y refresh y devuelve solo el perfil', async () => {
    const p = api.iniciarSesion('5512345678', '482915');
    const req = await pedido('POST', 'sesion');
    expect(req.request.body).toEqual({ celular: '5512345678', pin: '482915' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(SESION_API);
    expect(await p).toEqual({ operadorId: 'op-1', nombre: 'Juan Pérez López', celularTerminacion: '5678' });
    expect(await almacen.leer()).toEqual({ token: 'token-1', expiraEn: '2026-11-23T21:05:00Z', refreshToken: 'refresh-1', refreshExpiraEn: '2026-12-23T20:05:00Z' });
  });

  it('login 401: "Celular o PIN incorrectos." y no guarda nada', async () => {
    const p = api.iniciarSesion('5512345678', '000000');
    falla(await pedido('POST', 'sesion'), 401);
    expect(await errorDe(p)).toMatchObject({ tipo: 'sesion', message: MENSAJES.credenciales });
    expect(await almacen.leer()).toBeNull();
  });

  it('login 429: demasiados intentos, espere 15 minutos', async () => {
    const p = api.iniciarSesion('5512345678', '000000');
    falla(await pedido('POST', 'sesion'), 429);
    expect(await errorDe(p)).toMatchObject({ tipo: 'limite', message: 'Demasiados intentos. Espere 15 minutos y vuelva a intentar.' });
  });

  it('cerrar sesión: POST sesion/cerrar con el refresh (sin token) y DESPUÉS borra token y refresh', async () => {
    await almacen.guardar(CRED_1);
    const p = api.cerrarSesion();
    const req = await pedido('POST', 'sesion/cerrar');
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(await almacen.leer()).toEqual(CRED_1); // aún no se borra: primero el servidor
    req.flush(null, { status: 204, statusText: 'No Content' });
    await p;
    expect(await almacen.leer()).toBeNull();
  });

  it('cerrar sesión sin señal o con error del servidor: borra igual en el teléfono', async () => {
    await almacen.guardar(CRED_1);
    const p1 = api.cerrarSesion();
    (await pedido('POST', 'sesion/cerrar')).error(new ProgressEvent('error'));
    await p1;
    expect(await almacen.leer()).toBeNull();
    await almacen.guardar(CRED_1);
    const p2 = api.cerrarSesion();
    falla(await pedido('POST', 'sesion/cerrar'), 429);
    await p2;
    expect(await almacen.leer()).toBeNull();
  });

  it('cerrar sesión: si el servidor tarda más de la espera, no se bloquea; borra y cancela la petición', async () => {
    await almacen.guardar(CRED_1);
    const p = api.cerrarSesion();
    const req = await pedido('POST', 'sesion/cerrar');
    await p; // nadie responde: termina sola al agotarse la espera (200 ms en la prueba)
    expect(await almacen.leer()).toBeNull();
    expect(req.cancelled).toBe(true);
  });

  it('cerrar sesión sin credenciales: no llama al servidor y no falla', async () => {
    await api.cerrarSesion();
    http.expectNone(`${BASE}/sesion/cerrar`);
  });

  // ------------------------------------------------------------------ asignación

  it('asignación con viaje cargado, con el token en Authorization', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    const req = await pedido('GET', 'asignacion');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
    req.flush(SALIDA_CARGADA);
    const { salida } = await p;
    expect(salida!.viajes[0]).toMatchObject({ tipo: 'cargado', estatus: 'EnTransito', folio: 'VJE-000456' });
  });

  it('asignación de un vacío (id del viaje = id de la salida)', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    (await pedido('GET', 'asignacion')).flush(SALIDA_VACIA);
    const { salida } = await p;
    expect(salida!.viajes[0]).toMatchObject({ tipo: 'vacio', id: salida!.id });
  });

  it('asignación sin salida activa', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    (await pedido('GET', 'asignacion')).flush({ salida: null });
    expect(await p).toEqual({ salida: null });
  });

  // ------------------------------------------------------------------ renovación

  it('401 → renueva UNA vez con el refresh, guarda los nuevos y repite la petición con el token nuevo', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    falla(await pedido('GET', 'asignacion'), 401);
    const ren = await pedido('POST', 'sesion/renovar');
    expect(ren.request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(ren.request.headers.has('Authorization')).toBe(false);
    ren.flush(RENOVADA);
    const otra = await pedido('GET', 'asignacion');
    expect(otra.request.headers.get('Authorization')).toBe('Bearer token-2');
    otra.flush({ salida: null });
    expect(await p).toEqual({ salida: null });
    expect(await almacen.leer()).toMatchObject({ token: 'token-2', refreshToken: 'refresh-2' });
  });

  it('si renovar da 401: borra token y refresh y responde "sesion" (pedir el PIN)', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    falla(await pedido('GET', 'asignacion'), 401);
    falla(await pedido('POST', 'sesion/renovar'), 401);
    expect(await errorDe(p)).toMatchObject({ tipo: 'sesion', message: MENSAJES.sesionTerminada });
    expect(await almacen.leer()).toBeNull();
  });

  it('si tras renovar vuelve el 401: "sesion", sin renovar otra vez', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    falla(await pedido('GET', 'asignacion'), 401);
    (await pedido('POST', 'sesion/renovar')).flush(RENOVADA);
    falla(await pedido('GET', 'asignacion'), 401);
    expect((await errorDe(p)).tipo).toBe('sesion');
    http.expectNone(`${BASE}/sesion/renovar`);
  });

  it('renovar sin señal: sin-conexion y NO borra las credenciales', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    falla(await pedido('GET', 'asignacion'), 401);
    (await pedido('POST', 'sesion/renovar')).error(new ProgressEvent('error'));
    expect((await errorDe(p)).tipo).toBe('sin-conexion');
    expect(await almacen.leer()).toEqual(CRED_1);
  });

  it('dos peticiones con 401 al mismo tiempo: una sola renovación (el refresh es rotativo)', async () => {
    await almacen.guardar(CRED_1);
    const a = api.obtenerAsignacion();
    const b = api.consultarReportes(['x']);
    falla(await pedido('GET', 'asignacion'), 401);
    falla(await pedido('POST', 'reportes/estado'), 401);
    (await pedido('POST', 'sesion/renovar')).flush(RENOVADA);
    (await pedido('GET', 'asignacion')).flush({ salida: null });
    (await pedido('POST', 'reportes/estado')).flush([]);
    await Promise.all([a, b]);
  });

  it('si otra pestaña ya renovó, usa su token en vez de gastar el refresh viejo', async () => {
    await almacen.guardar(CRED_1);
    const p = api.obtenerAsignacion();
    const primera = await pedido('GET', 'asignacion');
    await almacen.guardar({ ...CRED_1, token: 'token-otra-pestana', refreshToken: 'refresh-otra' });
    falla(primera, 401);
    const otra = await pedido('GET', 'asignacion');
    expect(otra.request.headers.get('Authorization')).toBe('Bearer token-otra-pestana');
    http.expectNone(`${BASE}/sesion/renovar`);
    otra.flush({ salida: null });
    await p;
  });

  it('la renovación va dentro de un Web Lock (serializada entre pestañas)', async () => {
    TestBed.resetTestingModule();
    const request = vi.fn((_nombre: string, fn: () => Promise<unknown>) => fn());
    configurar({ onLine: true, locks: { request } as unknown as LockManager });
    await almacen.guardar(CRED_1);
    const p = api.renovarSesion();
    (await pedido('POST', 'sesion/renovar')).flush(RENOVADA);
    await p;
    expect(request).toHaveBeenCalledWith(NOMBRE_LOCK_RENOVACION, expect.any(Function));
  });

  it('sin credenciales guardadas: "sesion" sin llamar al servidor', async () => {
    expect((await errorDe(api.obtenerAsignacion())).tipo).toBe('sesion');
  });

  // ------------------------------------------------------------------ reportes

  it('reporte aplicado: POST reportes con el cuerpo del contrato', async () => {
    await almacen.guardar(CRED_1);
    const p = api.enviarReporte(REPORTE);
    const req = await pedido('POST', 'reportes');
    expect(req.request.body).toEqual({
      id: REPORTE.id,
      viajeId: 'via-1',
      tipo: 'estatus',
      estatus: 'EnPatioOrigen',
      ocurrioEn: '2026-11-23T20:05:00Z',
      ubicacion: { lat: 19.4326, lng: -99.1332, precisionM: 12.5, tomadoEn: '2026-11-23T20:04:58Z' },
      nota: null,
    });
    req.flush({ id: REPORTE.id, recibidoEn: '2026-11-23T20:05:03Z', resultado: 'aplicado', mensaje: null });
    expect(await p).toEqual({ id: REPORTE.id, recibidoEn: '2026-11-23T20:05:03Z', resultado: 'aplicado', mensaje: null });
  });

  it('ubicación con coordenadas y precisión vacía (precisionM null): se manda tal cual, el contrato la acepta', async () => {
    await almacen.guardar(CRED_1);
    const ubicacion = { lat: 19.4326, lng: -99.1332, precisionM: null, tomadoEn: '2026-11-23T20:04:58Z' };
    const p = api.enviarReporte({ ...REPORTE, ubicacion });
    const req = await pedido('POST', 'reportes');
    expect(req.request.body.ubicacion).toEqual(ubicacion);
    req.flush({ id: REPORTE.id, recibidoEn: '2026-11-23T20:05:03Z', resultado: 'aplicado', mensaje: null });
    expect((await p).resultado).toBe('aplicado');
  });

  for (const [resultado, mensaje] of [
    ['por-confirmar', 'Recibido; la oficina lo confirma.'],
    ['sin-efecto', 'La oficina ya registró En tránsito; el estatus no cambió.'],
    ['descartado', 'La oficina descartó el reporte: duplicado'],
  ] as const) {
    it(`reporte ${resultado}: el acuse trae resultado y mensaje`, async () => {
      await almacen.guardar(CRED_1);
      const p = api.enviarReporte(REPORTE);
      (await pedido('POST', 'reportes')).flush({ id: REPORTE.id, recibidoEn: 't', resultado, mensaje });
      expect(await p).toMatchObject({ resultado, mensaje });
    });
  }

  it('idempotencia: reenviar manda el MISMO id y el servidor devuelve el acuse actual', async () => {
    await almacen.guardar(CRED_1);
    const acuse = { id: REPORTE.id, recibidoEn: '2026-11-23T20:05:03Z', resultado: 'aplicado', mensaje: null };
    const p1 = api.enviarReporte(REPORTE);
    const r1 = await pedido('POST', 'reportes');
    r1.flush(acuse);
    const p2 = api.enviarReporte(REPORTE);
    const r2 = await pedido('POST', 'reportes');
    expect(r2.request.body).toEqual(r1.request.body);
    r2.flush(acuse);
    expect(await p2).toEqual(await p1);
  });

  const errores: [string, number, string | undefined, string][] = [
    ['400 OPERADOR_REPORTE_INVALIDO', 400, 'OPERADOR_REPORTE_INVALIDO', 'rechazado'],
    ['400 DESPACHO_EVENTO_INVALIDO', 400, 'DESPACHO_EVENTO_INVALIDO', 'rechazado'],
    ['400 DESPACHO_EVENTO_HORA_INVALIDA', 400, CODIGO_HORA_INVALIDA, 'rechazado'],
    ['404 OPERADOR_VIAJE_NO_ENCONTRADO', 404, 'OPERADOR_VIAJE_NO_ENCONTRADO', 'rechazado'],
    ['409 OPERADOR_SALIDA_CERRADA', 409, 'OPERADOR_SALIDA_CERRADA', 'rechazado'],
    ['409 DESPACHO_EVENTO_CLAVE_DUPLICADA', 409, CODIGO_CLAVE_DUPLICADA, 'id-duplicado'],
    ['403 OPERADOR_SIN_ACCESO', 403, CODIGO_SIN_ACCESO, 'sesion'],
    ['429', 429, undefined, 'limite'],
    ['503 CUENTA_ESQUEMA_DESACTUALIZADO', 503, 'CUENTA_ESQUEMA_DESACTUALIZADO', 'servidor'],
    ['500', 500, undefined, 'servidor'],
  ];
  for (const [nombre, status, codigo, tipo] of errores) {
    it(`error del reporte ${nombre} → ${tipo}`, async () => {
      await almacen.guardar(CRED_1);
      const p = api.enviarReporte(REPORTE);
      falla(await pedido('POST', 'reportes'), status, codigo);
      expect(await errorDe(p)).toMatchObject({ tipo, codigo: codigo ?? null, status });
    });
  }

  it('error del reporte sin respuesta (sin señal) → sin-conexion', async () => {
    await almacen.guardar(CRED_1);
    const p = api.enviarReporte(REPORTE);
    (await pedido('POST', 'reportes')).error(new ProgressEvent('error'));
    expect((await errorDe(p)).tipo).toBe('sin-conexion');
  });

  it('estado: POST reportes/estado con los ids; trae mensaje; de 200 en 200', async () => {
    await almacen.guardar(CRED_1);
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const p = api.consultarReportes(ids);
    const r1 = await pedido('POST', 'reportes/estado');
    expect(r1.request.body.ids).toHaveLength(200);
    r1.flush([{ id: 'id-0', resultado: 'confirmado', confirmadoEn: '2026-11-23T20:40:00Z', mensaje: null }]);
    const r2 = await pedido('POST', 'reportes/estado');
    expect(r2.request.body.ids).toEqual(ids.slice(200));
    r2.flush([{ id: 'id-200', resultado: 'sin-efecto', confirmadoEn: null, mensaje: 'La oficina anuló el estatus Documentado: faltó la carta porte. Puedes volver a reportarlo.' }]);
    expect(await p).toEqual([
      { id: 'id-0', resultado: 'confirmado', confirmadoEn: '2026-11-23T20:40:00Z', mensaje: null },
      { id: 'id-200', resultado: 'sin-efecto', confirmadoEn: null, mensaje: 'La oficina anuló el estatus Documentado: faltó la carta porte. Puedes volver a reportarlo.' },
    ]);
  });

  it('el PIN y los tokens nunca van a la consola ni a los mensajes de error', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const p1 = api.iniciarSesion('5512345678', '482915');
    (await pedido('POST', 'sesion')).flush(SESION_API);
    await p1;
    const p2 = api.obtenerAsignacion();
    falla(await pedido('GET', 'asignacion'), 401);
    falla(await pedido('POST', 'sesion/renovar'), 401, undefined, 'Sesión inválida');
    const err = await errorDe(p2);
    for (const e of espias) expect(e).not.toHaveBeenCalled();
    const texto = `${err.message} ${JSON.stringify(err)} ${String(err.stack)}`;
    for (const secreto of ['482915', 'token-1', 'refresh-1']) expect(texto).not.toContain(secreto);
  });
});
