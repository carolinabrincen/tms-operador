/**
 * DATOS DE EJEMPLO (ficticios). Clientes, folios, referencias, direcciones y teléfonos son inventados.
 * Sin tarifas, ingresos, costos, utilidad, pagos ni importes (tampoco de casetas o diésel): esos campos no existen en
 * los modelos del operador.
 *
 * Las citas se calculan a partir del día de hoy EN EL NEGOCIO (America/Mexico_City), para que el ejemplo siempre se
 * vea vigente.
 */
import { ahoraIsoUtc, diaNegocio } from '../../../shared/utils/zona-negocio.util';
import { EvidenciaViaje, HojaRuta } from '../operador-api-m2.modelos';
import { IncidenciaAbierta, IsoUtc, Salida, Unidad } from '../operador-api.modelos';

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
    // Las abiertas las calcula la "oficina" de ejemplo (ver incidenciaOficinaEjemplo).
    incidenciasAbiertas: [],
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
 * Incidencia que registró la OFICINA en el viaje 1 (vacío), 40 minutos antes, y sigue abierta: sirve para ver la tarjeta
 * ámbar y "Ya continué". Si el operador reporta un paso de ese viaje, el servidor (y el ejemplo) la termina sola.
 */
export function incidenciaOficinaEjemplo(ahora: Date): { viajeId: string; info: IncidenciaAbierta } {
  return {
    viajeId: 'ej-via-770',
    info: {
      id: 'ej-inc-oficina-1',
      tipo: 'RetenOInspeccion',
      ocurrioEn: ahoraIsoUtc(new Date(ahora.getTime() - 40 * 60 * 1000)),
      nota: 'Revisión de documentos a la salida del patio',
    },
  };
}

/**
 * En el ejemplo, un celular que termine en 0000 no tiene nada asignado: sirve para ver la pantalla
 * "No tiene un viaje activo".
 */
export const CELULAR_EJEMPLO_SIN_VIAJE = /0000$/;


/** Liga de Google Maps de ejemplo (mismo formato que manda el servidor: origen, puntos y destino). */
function ligaMapa(origen: string, destino: string, puntos: string[] = []): string {
  const q = new URLSearchParams({ api: '1', origin: origen, destination: destino });
  if (puntos.length) q.set('waypoints', puntos.join('|'));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}

/**
 * Hoja de ruta de la salida de ejemplo (contrato M2, sección 1). Los 4 tramos de salidaEjemplo, en orden; el viaje 2
 * con dirección completa, parada autorizada y casetas por nombre (sin monto); el 3 transporta material peligroso.
 */
export function hojaRutaEjemplo(ahora: Date): HojaRuta {
  return {
    folio: 'SAL-2026-00418',
    generadaEn: ahoraIsoUtc(new Date(ahora.getTime() - 2 * 60 * 60 * 1000)),
    empresa: 'Transportes de Ejemplo del Norte',
    telefonoEmpresa: '81 5550 0100',
    telefonoTrafico: '800 555 0199',
    salidaProgramada: citaNegocio(ahora, 0, '06:00'),
    finEstimado: diaNegocio(citaNegocio(ahora, 1, '18:00')),
    notas: 'Revise presión de llantas antes de salir. Cualquier retraso, avise a tráfico.',
    operador: { nombre: 'Operador de ejemplo', licenciaTipo: 'E', licenciaNumero: 'EJ-000000' },
    unidad: {
      numeroEconomico: 'T-104',
      placas: '41-AK-7R',
      configuracion: 'T3-S2 · Tractocamión con semirremolque',
      remolques: [{ numeroEconomico: 'R-221', placas: '12-UP-3X' }],
    },
    itinerario: [
      {
        orden: 1,
        tipo: 'vacio',
        folio: null,
        cliente: null,
        origen: { lugar: 'Patio Guadalupe, N.L.', direccion: null, descripcion: null },
        destino: { lugar: 'Estación de diésel, Carr. Miguel Alemán km 12', direccion: null, descripcion: null },
        citaCarga: null,
        citaDescarga: null,
        producto: null,
        materialPeligroso: null,
        toneladasProgramadas: null,
        referencia: null,
        notas: 'Cargar tanque lleno antes de ir a la planta.',
        motivo: 'CargaCombustible',
        motivoNota: null,
        km: 14,
        ruta: null,
      },
      {
        orden: 2,
        tipo: 'cargado',
        folio: 'VIA-2026-00771',
        cliente: 'Aceros del Norte (ejemplo)',
        origen: { lugar: 'Apodaca, N.L.', direccion: 'Av. Ejemplo 100, Parque Industrial, C.P. 66600', descripcion: 'Planta' },
        destino: { lugar: 'Saltillo, Coah.', direccion: 'Blvd. Muestra 2500, Zona Industrial, C.P. 25000', descripcion: 'Almacén' },
        citaCarga: citaNegocio(ahora, 0, '08:00'),
        citaDescarga: citaNegocio(ahora, 0, '13:00'),
        producto: 'Lámina rolada en caliente',
        materialPeligroso: false,
        toneladasProgramadas: 28.5,
        referencia: 'OC-55821',
        notas: 'Presentarse con equipo de protección completo. Acceso por la puerta 3.',
        motivo: null,
        motivoNota: null,
        km: 96.5,
        ruta: {
          nombre: 'Apodaca - Saltillo',
          km: 96.5,
          tiempo: { horas: 1, minutos: 40 },
          paradas: [{ orden: 1, tipo: 'Descanso', referencia: 'Parador km 40', notas: 'Máximo 30 minutos.', direccion: null, lat: 25.55, lng: -100.75 }],
          plazasCobro: [{ orden: 1, nombre: 'Plaza Santa Catarina (ejemplo)', autopista: 'Monterrey - Saltillo' }],
          ligaMapa: ligaMapa('Apodaca, N.L.', 'Saltillo, Coah.', ['25.55,-100.75']),
        },
      },
      {
        orden: 3,
        tipo: 'cargado',
        folio: 'VIA-2026-00772',
        cliente: 'Empaques del Bajío (ejemplo)',
        origen: { lugar: 'Ramos Arizpe, Coah.', direccion: null, descripcion: null },
        destino: { lugar: 'San Luis Potosí, S.L.P.', direccion: null, descripcion: null },
        citaCarga: citaNegocio(ahora, 0, '16:00'),
        citaDescarga: citaNegocio(ahora, 1, '08:00'),
        producto: 'Cartón corrugado en tarimas',
        materialPeligroso: true,
        toneladasProgramadas: 18,
        referencia: 'PED-90317',
        notas: null,
        motivo: null,
        motivoNota: null,
        km: 455,
        ruta: {
          nombre: 'Ramos Arizpe - San Luis Potosí',
          km: 455,
          tiempo: { horas: 5, minutos: 15 },
          paradas: [
            { orden: 1, tipo: 'CargaDiesel', referencia: 'Estación Matehuala (ejemplo)', notas: null, direccion: null, lat: null, lng: null },
            { orden: 2, tipo: 'Resguardo', referencia: 'Patio de resguardo km 300', notas: 'Si llega después de las 22:00.', direccion: null, lat: null, lng: null },
          ],
          plazasCobro: [
            { orden: 1, nombre: 'Plaza Los Chorros (ejemplo)', autopista: 'Saltillo - Matehuala' },
            { orden: 2, nombre: 'Plaza Huizache (ejemplo)', autopista: 'Matehuala - San Luis Potosí' },
          ],
          ligaMapa: ligaMapa('Ramos Arizpe, Coah.', 'San Luis Potosí, S.L.P.'),
        },
      },
      {
        orden: 4,
        tipo: 'vacio',
        folio: null,
        cliente: null,
        origen: { lugar: 'San Luis Potosí, S.L.P.', direccion: null, descripcion: null },
        destino: { lugar: 'Taller Diésel del Norte, Guadalupe, N.L.', direccion: null, descripcion: null },
        citaCarga: null,
        citaDescarga: null,
        producto: null,
        materialPeligroso: null,
        toneladasProgramadas: null,
        referencia: null,
        notas: 'Servicio de frenos programado al regresar.',
        motivo: 'Taller',
        motivoNota: 'Servicio de frenos',
        km: 510,
        ruta: null,
      },
    ],
    kmPlaneados: 1075.5,
    tiempoEstimado: { horas: 6, minutos: 55 },
  };
}

/** Evidencia que ya subió la oficina en el viaje 2 (un PDF): la app la muestra solo como renglón, sin archivo. */
export function evidenciasOficinaEjemplo(ahora: Date): EvidenciaViaje[] {
  return [
    {
      id: 'ej-evi-oficina-1',
      viajeId: 'ej-via-771',
      tipo: 'CartaPorteFirmada',
      descripcion: null,
      nota: 'Capturada en oficina',
      contentType: 'application/pdf',
      tamanoBytes: 245_760,
      subidaEn: ahoraIsoUtc(new Date(ahora.getTime() - 30 * 60 * 1000)),
      tomadaEn: null,
      autor: 'oficina',
    },
  ];
}
