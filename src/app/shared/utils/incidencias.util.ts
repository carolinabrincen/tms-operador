/** Incidencias del camino. No cambian el estatus del viaje. PURO. Valores del backend (P10 a), texto en pantalla. */
import { TIPOS_INCIDENCIA, TipoIncidencia } from '../../core/api/operador-api.modelos';

export const ETIQUETA_INCIDENCIA: Readonly<Record<TipoIncidencia, string>> = {
  DetenidoEnParador: 'Detenido en parador',
  IncidenciaMecanica: 'Falla mecánica',
  RetenOInspeccion: 'Retén o inspección',
  DesvioDeRuta: 'Desvío de ruta',
  Otro: 'Otro',
};

/** Texto de una incidencia; una desconocida se muestra tal cual. */
export function textoIncidencia(t: TipoIncidencia): string {
  return ETIQUETA_INCIDENCIA[t] ?? t;
}

export const INCIDENCIAS: readonly TipoIncidencia[] = TIPOS_INCIDENCIA;

/** Contrato M1: nota de hasta 500 caracteres. */
export const LARGO_NOTA = 500;

/** null si se puede enviar; si no, el mensaje visible. En "Otro" la nota es obligatoria (el servidor responde 400 sin ella). */
export function mensajeIncidencia(tipo: TipoIncidencia | null, nota: string | null | undefined): string | null {
  if (!tipo) return 'Elija qué pasó.';
  if (tipo === 'Otro' && !(nota ?? '').trim()) return 'En “Otro” escriba en la nota qué pasó.';
  if ((nota ?? '').length > LARGO_NOTA) return `La nota puede tener hasta ${LARGO_NOTA} letras.`;
  return null;
}

export function esTipoIncidencia(valor: unknown): valor is TipoIncidencia {
  return typeof valor === 'string' && (TIPOS_INCIDENCIA as readonly string[]).includes(valor);
}
