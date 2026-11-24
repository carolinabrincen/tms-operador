/** Respuestas de la API real tomadas del contrato M1 (docs/contrato-app-operador-m1.md), para pruebas. */

export const SALIDA_CARGADA = {
  salida: {
    id: 'sal-1',
    folio: 'DSP-000123',
    notas: 'Salida 6 am',
    unidad: { numeroEconomico: 'T-104', placas: '123-AB-4', configuracion: 'Sencillo 1 · Sencillo', remolques: ['R-220'] },
    viajes: [
      {
        tipo: 'cargado',
        id: 'via-1',
        folio: 'VJE-000456',
        orden: 1,
        notas: null,
        estatus: 'EnTransito',
        historial: [
          { tipo: 'estatus', estatus: 'Asignado', incidencia: null, nota: null, ocurrioEn: '2026-11-23T12:00:00Z', autor: 'oficina', reporteId: null },
          { tipo: 'estatus', estatus: 'EnPosicionamiento', incidencia: null, nota: null, ocurrioEn: '2026-11-23T13:00:00Z', autor: 'operador', reporteId: 'r-1' },
          { tipo: 'incidencia', estatus: null, incidencia: 'RetenOInspeccion', nota: 'Km 40', ocurrioEn: '2026-11-23T13:30:00Z', autor: 'operador', reporteId: 'r-2' },
        ],
        cliente: 'Comercializadora del Golfo',
        origen: 'Orizaba',
        destino: 'Córdoba',
        citaCarga: '2026-11-24T14:00:00Z',
        citaDescarga: null,
        producto: 'Cemento gris',
        toneladasProgramadas: 28.0,
        referencia: 'PO-7781',
      },
    ],
  },
};

export const SALIDA_VACIA = {
  salida: {
    id: 'sal-2',
    folio: 'DSP-000124',
    notas: null,
    unidad: { numeroEconomico: 'T-105', placas: '', configuracion: 'Tractocamión', remolques: [] },
    viajes: [
      {
        tipo: 'vacio',
        id: 'sal-2',
        folio: 'DSP-000124',
        orden: 1,
        notas: 'Diésel y revisión',
        estatus: 'EnTransitoVacio',
        historial: [],
        tramos: [
          { orden: 1, motivo: 'CargaCombustible', origen: 'Base', destino: 'Gasolinera km 12' },
          { orden: 2, motivo: 'Taller', origen: 'Gasolinera km 12', destino: 'Taller Diesel' },
        ],
      },
    ],
  },
};

export const SESION_API = {
  operadorId: 'op-1',
  nombre: 'Juan Pérez López',
  celularTerminacion: '5678',
  token: 'token-1',
  expiraEn: '2026-11-23T21:05:00Z',
  refreshToken: 'refresh-1',
  refreshExpiraEn: '2026-12-23T20:05:00Z',
};
