/**
 * Línea de tiempo de un viaje: estatus e incidencias ya ocurridos, con su hora y quién los puso. PURO.
 *
 * Junta lo que dice el servidor (historial) con lo que el operador reportó y el servidor aún no refleja (pendiente de
 * enviar, o hito por confirmar). No muestra rechazados ni reportes de estatus recibidos sin efecto.
 */
import { Autor, Viaje } from '../../core/api/operador-api.modelos';
import { ETIQUETA_ESTATUS, ReporteParaGuia } from './estatus-viaje.util';
import { ETIQUETA_INCIDENCIA } from './incidencias.util';

export interface EntradaLinea {
  clave: string;
  ocurrioEn: string;
  tipo: 'estatus' | 'incidencia';
  texto: string;
  nota: string | null;
  autor: Autor;
  /** Aclaración cuando aún no es definitivo: "Pendiente de enviar", "Pendiente de confirmar por oficina". */
  marca: string | null;
}

export const QUIEN: Readonly<Record<Autor, string>> = { operador: 'Usted', oficina: 'Oficina' };

const MARCA_LOCAL: Readonly<Record<string, string | null>> = {
  pendiente: 'Pendiente de enviar',
  'por-confirmar': 'Pendiente de confirmar por oficina',
  enviado: null,
  confirmado: null,
};

export function lineaDeTiempo(v: Viaje, reportes: readonly ReporteParaGuia[]): EntradaLinea[] {
  const entradas: EntradaLinea[] = v.historial.map((e, i) => ({
    clave: e.reporteId ?? `servidor-${i}`,
    ocurrioEn: e.ocurrioEn,
    tipo: e.tipo,
    texto: e.tipo === 'estatus' ? ETIQUETA_ESTATUS[e.estatus] : `Incidencia: ${ETIQUETA_INCIDENCIA[e.incidencia]}`,
    nota: e.tipo === 'incidencia' ? e.nota : null,
    autor: e.autor,
    marca: null,
  }));
  const yaEnServidor = new Set(v.historial.map((e) => e.reporteId).filter((x): x is string => !!x));

  for (const r of reportes) {
    const rep = r.reporte;
    if (rep.viajeId !== v.id || yaEnServidor.has(rep.id)) continue;
    if (r.estado === 'rechazado' || (rep.tipo === 'estatus' && r.aviso)) continue;
    // Un intermedio "enviado" ya se aplicó en el servidor; si el historial aún no lo trae es porque falta actualizar.
    entradas.push({
      clave: rep.id,
      ocurrioEn: rep.ocurrioEn,
      tipo: rep.tipo,
      texto: rep.tipo === 'estatus' ? ETIQUETA_ESTATUS[rep.estatus] : `Incidencia: ${ETIQUETA_INCIDENCIA[rep.incidencia]}`,
      nota: rep.nota,
      autor: 'operador',
      marca: MARCA_LOCAL[r.estado] ?? null,
    });
  }
  return entradas.sort((a, b) => a.ocurrioEn.localeCompare(b.ocurrioEn) || a.clave.localeCompare(b.clave));
}
