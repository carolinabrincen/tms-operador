/**
 * DATOS DE EJEMPLO (ficticios). Clientes, folios y referencias son inventados.
 * Sin tarifas, ingresos, costos, utilidad ni pagos: esos campos no existen en los modelos del operador.
 *
 * Las citas se calculan a partir del día de hoy EN EL NEGOCIO (America/Mexico_City), para que el ejemplo siempre se
 * vea vigente.
 */
import { diaNegocio } from '../../../shared/utils/zona-negocio.util';
import { AsignacionOperador, Despacho, IsoUtc, MovimientoVacio, Unidad } from '../operador-api.modelos';

/** Desfase del centro de México (sin horario de verano desde 2022). */
const DESFASE_NEGOCIO = '-06:00';

/** "hoy + dias" a la hora HH:mm del negocio → ISO UTC. */
function citaNegocio(ahora: Date, dias: number, hhmm: string): IsoUtc {
  const [y, m, d] = diaNegocio(ahora.toISOString()).split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d + dias, 12));
  const texto = `${dia.toISOString().slice(0, 10)}T${hhmm}:00${DESFASE_NEGOCIO}`;
  return new Date(texto).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const UNIDAD: Unidad = {
  numeroEconomico: 'T-104',
  placas: '41-AK-7R',
  configuracion: 'T3-S2 · Tractocamión con semirremolque',
  remolques: ['Caja seca 53 pies · R-221'],
};

export function despachoEjemplo(ahora: Date): Despacho {
  return {
    id: 'ej-des-418',
    folio: 'DES-2026-00418',
    unidad: UNIDAD,
    notas: 'Revise presión de llantas antes de salir. Cualquier retraso, avise a tráfico.',
    tramos: [
      {
        tipo: 'vacio',
        id: 'ej-tra-1',
        orden: 1,
        origen: 'Patio Guadalupe, N.L.',
        destino: 'Apodaca, N.L.',
        notas: 'Ir directo a la planta del cliente.',
      },
      {
        tipo: 'cargado',
        id: 'ej-tra-2',
        orden: 2,
        viaje: {
          id: 'ej-via-771',
          folio: 'VIA-2026-00771',
          cliente: 'Aceros del Norte (ejemplo)',
          origen: 'Apodaca, N.L.',
          destino: 'Saltillo, Coah.',
          citaCarga: citaNegocio(ahora, 0, '08:00'),
          citaDescarga: citaNegocio(ahora, 0, '13:00'),
          producto: 'Lámina rolada en caliente',
          toneladasProgramadas: 28.5,
          referencia: 'OC-55821',
          notas: 'Presentarse con equipo de protección completo. Acceso por la puerta 3.',
        },
      },
      {
        tipo: 'cargado',
        id: 'ej-tra-3',
        orden: 3,
        viaje: {
          id: 'ej-via-772',
          folio: 'VIA-2026-00772',
          cliente: 'Empaques del Bajío (ejemplo)',
          origen: 'Ramos Arizpe, Coah.',
          destino: 'San Luis Potosí, S.L.P.',
          citaCarga: citaNegocio(ahora, 0, '16:00'),
          citaDescarga: citaNegocio(ahora, 1, '08:00'),
          producto: 'Cartón corrugado en tarimas',
          toneladasProgramadas: 18,
          referencia: 'PED-90317',
          notas: null,
        },
      },
      {
        tipo: 'vacio',
        id: 'ej-tra-4',
        orden: 4,
        origen: 'San Luis Potosí, S.L.P.',
        destino: 'Patio Guadalupe, N.L.',
        notas: 'Regreso vacío a base.',
      },
    ],
  };
}

export function movimientosEjemplo(ahora: Date): MovimientoVacio[] {
  return [
    {
      id: 'ej-mov-93',
      folio: 'MV-2026-00093',
      motivo: 'Carga de combustible',
      unidad: UNIDAD,
      origen: 'Patio Guadalupe, N.L.',
      destino: 'Estación de diésel, Carr. Miguel Alemán km 12',
      programadoPara: citaNegocio(ahora, 0, '06:30'),
      notas: 'Cargar tanque lleno antes del primer tramo.',
    },
  ];
}

/**
 * En el ejemplo, un celular que termine en 0000 no tiene nada asignado: sirve para ver la pantalla
 * "No tiene un despacho activo".
 */
export const CELULAR_EJEMPLO_SIN_DESPACHO = /0000$/;

export function asignacionEjemplo(ahora: Date, sinDespacho: boolean): AsignacionOperador {
  return sinDespacho ? { despacho: null, movimientosVacio: [] } : { despacho: despachoEjemplo(ahora), movimientosVacio: movimientosEjemplo(ahora) };
}
