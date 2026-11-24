/**
 * DATOS DE EJEMPLO (ficticios). Clientes, folios y referencias son inventados.
 * Sin tarifas, ingresos, costos, utilidad ni pagos: esos campos no existen en los modelos del operador.
 *
 * Las citas se calculan a partir del día de hoy EN EL NEGOCIO (America/Mexico_City), para que el ejemplo siempre se
 * vea vigente.
 */
import { ahoraIsoUtc, diaNegocio } from '../../../shared/utils/zona-negocio.util';
import { IsoUtc, Salida, Unidad } from '../operador-api.modelos';

/** Desfase del centro de México (sin horario de verano desde 2022). */
const DESFASE_NEGOCIO = '-06:00';

/** "hoy + dias" a la hora HH:mm del negocio → ISO UTC. */
function citaNegocio(ahora: Date, dias: number, hhmm: string): IsoUtc {
  const [y, m, d] = diaNegocio(ahora.toISOString()).split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d + dias, 12));
  return ahoraIsoUtc(new Date(`${dia.toISOString().slice(0, 10)}T${hhmm}:00${DESFASE_NEGOCIO}`));
}

const UNIDAD: Unidad = {
  numeroEconomico: 'T-104',
  placas: '41-AK-7R',
  configuracion: 'T3-S2 · Tractocamión con semirremolque',
  remolques: ['Caja seca 53 pies · R-221'],
};

/**
 * Salida de ejemplo: 4 viajes en orden.
 *  1. Vacío a cargar combustible (al llegar: EnPatio).
 *  2. Cargado Apodaca → Saltillo.
 *  3. Cargado Ramos Arizpe → San Luis Potosí.
 *  4. Vacío de regreso; su último tramo va a Taller (al llegar: EnTaller).
 * Todos empiezan en "Asignado", puesto por la oficina una hora antes.
 */
export function salidaEjemplo(ahora: Date): Salida {
  const asignadoEn = ahoraIsoUtc(new Date(ahora.getTime() - 60 * 60 * 1000));
  const asignado = () => [{ tipo: 'estatus' as const, estatus: 'Asignado' as const, nota: null, ocurrioEn: asignadoEn, autor: 'oficina' as const, reporteId: null }];
  return {
    id: 'ej-sal-418',
    folio: 'SAL-2026-00418',
    unidad: UNIDAD,
    notas: 'Revise presión de llantas antes de salir. Cualquier retraso, avise a tráfico.',
    viajes: [
      {
        tipo: 'vacio',
        id: 'ej-via-770',
        folio: 'VIA-2026-00770',
        orden: 1,
        estatus: 'Asignado',
        notas: 'Cargar tanque lleno antes de ir a la planta.',
        historial: asignado(),
        tramos: [{ orden: 1, motivo: 'CargaCombustible', origen: 'Patio Guadalupe, N.L.', destino: 'Estación de diésel, Carr. Miguel Alemán km 12' }],
      },
      {
        tipo: 'cargado',
        id: 'ej-via-771',
        folio: 'VIA-2026-00771',
        orden: 2,
        estatus: 'Asignado',
        cliente: 'Aceros del Norte (ejemplo)',
        origen: 'Apodaca, N.L.',
        destino: 'Saltillo, Coah.',
        citaCarga: citaNegocio(ahora, 0, '08:00'),
        citaDescarga: citaNegocio(ahora, 0, '13:00'),
        producto: 'Lámina rolada en caliente',
        toneladasProgramadas: 28.5,
        referencia: 'OC-55821',
        notas: 'Presentarse con equipo de protección completo. Acceso por la puerta 3.',
        historial: asignado(),
      },
      {
        tipo: 'cargado',
        id: 'ej-via-772',
        folio: 'VIA-2026-00772',
        orden: 3,
        estatus: 'Asignado',
        cliente: 'Empaques del Bajío (ejemplo)',
        origen: 'Ramos Arizpe, Coah.',
        destino: 'San Luis Potosí, S.L.P.',
        citaCarga: citaNegocio(ahora, 0, '16:00'),
        citaDescarga: citaNegocio(ahora, 1, '08:00'),
        producto: 'Cartón corrugado en tarimas',
        toneladasProgramadas: 18,
        referencia: 'PED-90317',
        notas: null,
        historial: asignado(),
      },
      {
        tipo: 'vacio',
        id: 'ej-via-773',
        folio: 'VIA-2026-00773',
        orden: 4,
        estatus: 'Asignado',
        notas: 'Servicio de frenos programado al regresar.',
        historial: asignado(),
        tramos: [
          { orden: 1, motivo: 'Posicionamiento', origen: 'San Luis Potosí, S.L.P.', destino: 'Patio Guadalupe, N.L.' },
          { orden: 2, motivo: 'Taller', origen: 'Patio Guadalupe, N.L.', destino: 'Taller Diésel del Norte, Guadalupe, N.L.' },
        ],
      },
    ],
  };
}

/**
 * En el ejemplo, un celular que termine en 0000 no tiene nada asignado: sirve para ver la pantalla
 * "No tiene un viaje activo".
 */
export const CELULAR_EJEMPLO_SIN_VIAJE = /0000$/;
