/** Hoja de ruta en pantalla (contrato M2, sección 1). PURO. */
import { LugarHoja, TiempoHoja, TipoParada } from '../../core/api/operador-api-m2.modelos';

export const ETIQUETA_PARADA: Readonly<Record<TipoParada, string>> = {
  Descanso: 'Descanso',
  CambioChofer: 'Cambio de chofer',
  CargaDiesel: 'Carga de diésel',
  Resguardo: 'Resguardo',
  Otro: 'Otra parada',
};

export function textoParada(t: TipoParada): string {
  return ETIQUETA_PARADA[t] ?? t;
}

/** "tel:8115550100" para llamar al tocar; null si no parece un teléfono. Se conservan solo dígitos (y un + inicial). */
export function ligaTelefono(t: string | null | undefined): string | null {
  if (!t) return null;
  const limpio = t.trim().replace(/(?!^\+)[^\d]/g, '');
  return limpio.replace(/\D/g, '').length >= 7 ? `tel:${limpio}` : null;
}

/** "2026-11-27" → "27/11/2026" (es solo fecha: no se convierte de zona). Lo que no tenga esa forma se muestra tal cual. */
export function fechaSinHora(f: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (f ?? '');
}

/** "9 h 30 min", "45 min", "2 h". */
export function textoTiempo(t: TiempoHoja | null | undefined): string {
  if (!t) return '';
  const partes = [t.horas ? `${t.horas} h` : '', t.minutos ? `${t.minutos} min` : ''].filter(Boolean);
  return partes.join(' ') || '0 min';
}

const NUMERO = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** "812.5 km". */
export function textoKm(km: number | null | undefined): string {
  return km == null ? '' : `${NUMERO.format(km)} km`;
}

/** "28.5 t". */
export function textoToneladas(t: number | null | undefined): string {
  return t == null ? '' : `${NUMERO.format(t)} t`;
}

/** Renglón secundario de un lugar: "Planta · Carretera 45 km 3, Centro, C.P. 38160". */
export function detalleLugar(l: LugarHoja): string {
  return [l.descripcion, l.direccion].filter(Boolean).join(' · ');
}

/**
 * Aviso de que la hoja mostrada puede no ser la de la salida actual (la asignación dice otro folio). null si
 * coinciden o si no se sabe.
 */
export function avisoOtraSalida(folioHoja: string | null | undefined, folioAsignacion: string | null | undefined): string | null {
  if (!folioHoja || !folioAsignacion || folioHoja === folioAsignacion) return null;
  return `Esta hoja es de la salida ${folioHoja}, pero su salida actual es ${folioAsignacion}. Actualice con señal.`;
}
