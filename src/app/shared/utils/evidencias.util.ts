/**
 * Fotos de evidencia (contrato M2, sección 2). PURO: textos, validación y reglas de la cola de fotos.
 *
 * Ciclo de una foto en el teléfono: pendiente → enviada (acuse) → recibida (el servidor la confirma vigente) o
 * anulada (la oficina la anuló, con su motivo). Si el servidor no la acepta: rechazada ("No aceptada"). Una enviada que
 * el servidor no conoce al consultar el estado se vuelve a subir con el mismo id (no duplica).
 */
import { CODIGOS_EVIDENCIA, TipoErrorApi } from '../../core/api/operador-api';
import { AcuseEvidencia, EstadoRemotoEvidencia, TIPOS_EVIDENCIA, TipoEvidencia } from '../../core/api/operador-api-m2.modelos';
import { IsoUtc, Viaje } from '../../core/api/operador-api.modelos';
import { EstadoEvidenciaLocal, EvidenciaLocal } from '../../core/evidencias/evidencia-local';

export const ETIQUETA_EVIDENCIA: Readonly<Record<TipoEvidencia, string>> = {
  Remision: 'Remisión',
  CartaPorteFirmada: 'Carta Porte firmada',
  Sellos: 'Sellos',
  TicketBascula: 'Ticket de báscula',
  AcuseRecibido: 'Acuse de recibido',
  Dano: 'Daño',
  Otro: 'Otro',
};

export const TIPOS_FOTO: readonly TipoEvidencia[] = TIPOS_EVIDENCIA;

/** Texto de un tipo; uno desconocido se muestra tal cual. */
export function textoEvidencia(t: TipoEvidencia): string {
  return ETIQUETA_EVIDENCIA[t] ?? t;
}

export const LARGO_DESCRIPCION_FOTO = 150;
export const LARGO_NOTA_FOTO = 500;
/** Límite del servidor por foto. Tras reducirla pesa 0.3 a 0.6 MB. */
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;
/** Desde cuántas fotos sin enviar se avisa. */
export const AVISO_FOTOS_SIN_ENVIAR = 10;

export const ETIQUETA_ESTADO_FOTO: Readonly<Record<EstadoEvidenciaLocal, string>> = {
  pendiente: 'Pendiente',
  enviada: 'Enviada',
  recibida: 'Recibida',
  anulada: 'Anulada por la oficina',
  rechazada: 'No aceptada',
};

/** Error de captura en la hoja de la foto, o null si se puede guardar. */
export function mensajeFoto(tipo: TipoEvidencia | null, descripcion: string | null | undefined, hayFoto: boolean): string | null {
  if (!hayFoto) return 'Tome la foto o elíjala de la galería.';
  if (!tipo) return 'Elija qué es la foto.';
  if (tipo === 'Otro' && !descripcion?.trim()) return 'En “Otro” escriba qué es la foto.';
  return null;
}

/** ¿Se pueden agregar fotos a este viaje desde la app? Solo cargados (P8 a) y no cancelados. */
export function admiteFotos(v: Viaje): boolean {
  return v.tipo === 'cargado' && v.estatus !== 'Cancelado';
}

/** Explicación cuando no se puede agregar la foto desde la app. */
export const TEXTO_FOTO_CANCELADO = 'La oficina canceló este viaje: ya no se suben fotos desde la app. Si hace falta una, la oficina puede subirla.';

/**
 * Texto de usted para cada código de error del contrato (2.1). Si llega otro código, el mensaje del servidor (ya
 * viene de usted) y, si no hay, uno general.
 */
export const MENSAJE_ERROR_FOTO: Readonly<Record<string, string>> = {
  [CODIGOS_EVIDENCIA.claveDuplicada]: 'Esta foto chocó con otra ya subida. Tómela de nuevo.',
  [CODIGOS_EVIDENCIA.viajeNoEncontrado]: 'Este viaje ya no está entre sus salidas. Avise a la oficina.',
  [CODIGOS_EVIDENCIA.salidaCerrada]: 'La salida se cerró hace más de 72 horas: ya no se suben fotos desde la app. La oficina puede subirla.',
  [CODIGOS_EVIDENCIA.estadoInvalido]: TEXTO_FOTO_CANCELADO,
  [CODIGOS_EVIDENCIA.archivoInvalido]: 'La foto no se pudo leer como imagen JPG o PNG. Tómela de nuevo.',
  [CODIGOS_EVIDENCIA.demasiadoGrande]: 'La foto pesa más de 5 MB. Tómela de nuevo.',
  [CODIGOS_EVIDENCIA.limite]: 'Ya se alcanzó el máximo de fotos (30 por viaje o 10 por evento). Avise a la oficina.',
  [CODIGOS_EVIDENCIA.invalida]: 'La oficina no aceptó los datos de la foto (tipo, descripción, nota o ubicación). Revíselos y tómela de nuevo.',
};

export function mensajeErrorFoto(codigo: string | null, mensajeServidor: string | null): string {
  return (codigo && MENSAJE_ERROR_FOTO[codigo]) || mensajeServidor || 'La oficina no aceptó la foto.';
}

/** "Faltan enviar 3 fotos" / "Falta enviar 1 foto". */
export function textoFotosPendientes(n: number): string {
  return n === 1 ? 'Falta enviar 1 foto' : `Faltan enviar ${n} fotos`;
}

/** Aviso cuando se acumulan muchas fotos sin enviar (ocupan espacio y datos). null si no hace falta. */
export function avisoFotosAcumuladas(pendientes: number): string | null {
  if (pendientes < AVISO_FOTOS_SIN_ENVIAR) return null;
  return `Tiene ${pendientes} fotos sin enviar guardadas en el teléfono. Se enviarán solas con señal; si puede, conéctese a wifi.`;
}

// ------------------------------------------------------------------ cola

const ESPERAS_S = [5, 15, 30, 60, 120];

export function retrasoReintentoFotoMs(intentos: number): number {
  const i = Math.min(Math.max(intentos, 1), ESPERAS_S.length) - 1;
  return ESPERAS_S[i] * 1000;
}

/** Estado de un reporte local, lo mínimo para saber si una foto ligada a él ya puede subirse. */
export interface ReporteParaFoto {
  id: string;
  estado: string;
}

/**
 * Pendientes de ese operador, en el orden en que se tomaron. Una foto ligada a un reporte que aún no llega al
 * servidor espera a que llegue (si no, el servidor rechazaría el `reporteId`).
 */
export function fotosPorEnviar(fotos: readonly EvidenciaLocal[], operadorId: string, reportes: readonly ReporteParaFoto[] = []): EvidenciaLocal[] {
  const esperando = new Set(reportes.filter((r) => r.estado === 'pendiente').map((r) => r.id));
  return fotos
    .filter((f) => f.operadorId === operadorId && f.estado === 'pendiente' && f.foto != null)
    .filter((f) => !f.datos.reporteId || !esperando.has(f.datos.reporteId))
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id));
}

/**
 * Fotos cuyo estado puede cambiar en el servidor: enviadas (¿llegó?) y recibidas de un viaje de la salida activa (la
 * oficina puede anularlas). Lo más reciente primero, hasta `max` (200 ids por consulta).
 */
export function fotosPorConsultar(
  fotos: readonly EvidenciaLocal[],
  operadorId: string,
  viajesActivos: ReadonlySet<string> = new Set(),
  max = 200,
): EvidenciaLocal[] {
  return fotos
    .filter((f) => f.operadorId === operadorId && (f.estado === 'enviada' || (f.estado === 'recibida' && viajesActivos.has(f.datos.viajeId))))
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .slice(0, max);
}

export function crearEvidenciaLocal(
  datos: EvidenciaLocal['datos'],
  operadorId: string,
  resumen: string,
  foto: ArrayBuffer,
  tipoContenido: string,
  ahora: IsoUtc,
): EvidenciaLocal {
  return {
    id: datos.id,
    operadorId,
    datos,
    resumen,
    foto,
    tipoContenido,
    tamanoBytes: foto.byteLength,
    estado: 'pendiente',
    mensaje: null,
    creadoEn: ahora,
    intentos: 0,
    ultimoIntentoEn: null,
    enviadaEn: null,
    error: null,
  };
}

export function conAcuseFoto(f: EvidenciaLocal, acuse: AcuseEvidencia, ahora: IsoUtc): EvidenciaLocal {
  return { ...f, estado: 'enviada', mensaje: acuse.mensaje, intentos: f.intentos + 1, ultimoIntentoEn: ahora, enviadaEn: acuse.recibidaEn || ahora, error: null };
}

/** Falla al subir: rechazada = definitiva (se conserva la foto para mostrársela a la oficina); otra = sigue pendiente. */
export function conFallaFoto(f: EvidenciaLocal, tipo: TipoErrorApi, mensaje: string, ahora: IsoUtc): EvidenciaLocal {
  return { ...f, estado: tipo === 'rechazado' ? 'rechazada' : 'pendiente', intentos: f.intentos + 1, ultimoIntentoEn: ahora, error: mensaje };
}

/** La misma foto con otro id (409: ese id se usó con otra foto). Sigue pendiente para reenviarse. */
export function conNuevoIdFoto(f: EvidenciaLocal, id: string): EvidenciaLocal {
  return { ...f, id, datos: { ...f.datos, id }, estado: 'pendiente', error: null };
}

/** Aplica el estado del servidor. Recibida o anulada: la foto ya no hace falta en el teléfono. Sin cambios = mismo objeto. */
export function conEstadoRemotoFoto(f: EvidenciaLocal, remoto: EstadoRemotoEvidencia): EvidenciaLocal {
  if (f.estado !== 'enviada' && f.estado !== 'recibida') return f;
  if (remoto.estado === 'recibida') return f.estado === 'recibida' ? f : { ...f, estado: 'recibida', foto: null };
  return { ...f, estado: 'anulada', mensaje: remoto.motivo ?? 'La oficina anuló la evidencia.', foto: null };
}

/** Enviada que el servidor no conoce (la respuesta se perdió o no llegó): se reenvía con el mismo id. */
export function conReenvioFoto(f: EvidenciaLocal): EvidenciaLocal {
  return f.estado === 'enviada' && f.foto ? { ...f, estado: 'pendiente', error: null } : f;
}

/**
 * Liga de la foto al enviarla: si el reporte ligado ya no existe en el teléfono o no fue aceptado ("No aceptado"), la
 * foto va SIN liga (importa más que llegue). Sin cambios = el mismo objeto.
 */
export function sinLigaPerdida(f: EvidenciaLocal, reportes: readonly ReporteParaFoto[]): EvidenciaLocal {
  const id = f.datos.reporteId;
  if (!id) return f;
  const r = reportes.find((x) => x.id === id);
  return r && r.estado !== 'rechazado' ? f : sinLiga(f);
}

/** La misma foto sin liga a un reporte. */
export function sinLiga(f: EvidenciaLocal): EvidenciaLocal {
  return { ...f, datos: { ...f.datos, reporteId: null } };
}

/** El reporte ligado cambió de id (409 de id duplicado): la foto sigue al id nuevo. Sin cambios = el mismo objeto. */
export function conLigaNueva(f: EvidenciaLocal, viejo: string, nuevo: string): EvidenciaLocal {
  return f.datos.reporteId === viejo ? { ...f, datos: { ...f.datos, reporteId: nuevo } } : f;
}

/** Lo más reciente primero. */
export function fotosRecientes(fotos: readonly EvidenciaLocal[]): EvidenciaLocal[] {
  return [...fotos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id));
}

const ESTADOS: readonly EstadoEvidenciaLocal[] = ['pendiente', 'enviada', 'recibida', 'anulada', 'rechazada'];

/** Registro leído del teléfono → EvidenciaLocal, o null si está dañado. */
export function normalizarEvidenciaLocal(x: unknown): EvidenciaLocal | null {
  const f = x as EvidenciaLocal | null;
  if (!f || typeof f.id !== 'string' || typeof f.operadorId !== 'string' || !f.datos || typeof f.datos.viajeId !== 'string') return null;
  if (!ESTADOS.includes(f.estado)) return null;
  // toString y no instanceof: lo leído de IndexedDB puede venir de otro "realm".
  const esBytes = Object.prototype.toString.call(f.foto) === '[object ArrayBuffer]';
  return { ...f, foto: esBytes ? f.foto : null };
}

// ------------------------------------------------------------------ sugerencia del acuse

/** Lo mínimo de un reporte local para la sugerencia (sirve con ReporteLocal). */
export interface ReporteParaSugerencia {
  id: string;
  estado: string;
  resultado?: string | null;
  creadoEn: string;
  reporte: { tipo: string; viajeId: string; estatus?: string };
}

export interface SugerenciaAcuse {
  viaje: Viaje;
  /** El Descargado al que se liga la foto. */
  reporteId: string;
}

/**
 * Después de reportar Descargado se sugiere la foto del acuse de recibido, ligada a ese reporte. Es solo una sugerencia:
 * no aparece si ya hay una foto ligada a ese reporte o un acuse de ese viaje en el teléfono, si el operador dijo
 * "Ahora no" o si el viaje se canceló.
 */
export function sugerenciasAcuse(
  viajes: readonly Viaje[],
  reportes: readonly ReporteParaSugerencia[],
  fotos: readonly EvidenciaLocal[],
  omitidas: ReadonlySet<string>,
): SugerenciaAcuse[] {
  const res: SugerenciaAcuse[] = [];
  for (const v of viajes) {
    if (!admiteFotos(v)) continue;
    const descargado = reportes
      .filter((r) => r.reporte.viajeId === v.id && r.reporte.tipo === 'estatus' && r.reporte.estatus === 'Descargado')
      .filter((r) => r.estado !== 'rechazado' && r.estado !== 'descartado' && r.resultado !== 'sin-efecto')
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
    if (!descargado || omitidas.has(descargado.id)) continue;
    const yaHay = fotos.some(
      (f) => f.estado !== 'rechazada' && f.estado !== 'anulada' && (f.datos.reporteId === descargado.id || (f.datos.viajeId === v.id && f.datos.tipo === 'AcuseRecibido')),
    );
    if (!yaHay) res.push({ viaje: v, reporteId: descargado.id });
  }
  return res;
}
