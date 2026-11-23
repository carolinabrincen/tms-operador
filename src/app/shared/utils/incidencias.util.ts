/** Incidencias del camino. No cambian el estatus del viaje. PURO. */
import { TIPOS_INCIDENCIA, TipoIncidencia } from '../../core/api/operador-api.modelos';

export const ETIQUETA_INCIDENCIA: Readonly<Record<TipoIncidencia, string>> = {
  DetenidoParador: 'Detenido en parador',
  FallaMecanica: 'Falla mecánica',
  RetenInspeccion: 'Retén o inspección',
  DesvioRuta: 'Desvío de ruta',
  Otro: 'Otro',
};

export const INCIDENCIAS: readonly TipoIncidencia[] = TIPOS_INCIDENCIA;

export const LARGO_NOTA = 500;

/** null si se puede enviar; si no, el mensaje visible. En "Otro" la nota es obligatoria. */
export function mensajeIncidencia(tipo: TipoIncidencia | null, nota: string | null | undefined): string | null {
  if (!tipo) return 'Elija qué pasó.';
  if (tipo === 'Otro' && !(nota ?? '').trim()) return 'En “Otro” escriba en la nota qué pasó.';
  if ((nota ?? '').length > LARGO_NOTA) return `La nota puede tener hasta ${LARGO_NOTA} letras.`;
  return null;
}

export function esTipoIncidencia(valor: unknown): valor is TipoIncidencia {
  return typeof valor === 'string' && (TIPOS_INCIDENCIA as readonly string[]).includes(valor);
}
