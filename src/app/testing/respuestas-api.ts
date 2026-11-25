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

/** Hoja de ruta tal como viene en el contrato M2 (sección 1). */
export const HOJA_RUTA_API = {
  hojaRuta: {
    folio: 'DSP-000123',
    generadaEn: '2026-11-24T18:00:00Z',
    empresa: 'Transportes Norte',
    telefonoEmpresa: '55 1234 5678',
    telefonoTrafico: '800 123 4567',
    salidaProgramada: '2026-11-25T12:00:00Z',
    finEstimado: '2026-11-27',
    notas: 'Salida 6 am',
    operador: { nombre: 'Juan Perez', licenciaTipo: 'E', licenciaNumero: 'ABC123' },
    unidad: { numeroEconomico: 'T-01', placas: '123-AB', configuracion: 'Sencillo 1 · Sencillo', remolques: [{ numeroEconomico: 'C-07', placas: '45-XY' }] },
    itinerario: [
      {
        orden: 1,
        tipo: 'vacio',
        folio: null,
        cliente: null,
        origen: { lugar: 'Base', direccion: null, descripcion: null },
        destino: { lugar: 'Planta', direccion: null, descripcion: null },
        citaCarga: null,
        citaDescarga: null,
        producto: null,
        materialPeligroso: null,
        toneladasProgramadas: null,
        referencia: null,
        notas: null,
        motivo: 'Posicionamiento',
        motivoNota: null,
        km: 40,
        ruta: null,
      },
      {
        orden: 2,
        tipo: 'cargado',
        folio: 'VJE-000045',
        cliente: 'Cementos del Centro',
        origen: { lugar: 'Apaseo el Grande, Guanajuato', direccion: 'Carretera 45 km 3, Centro, C.P. 38160', descripcion: 'Planta' },
        destino: { lugar: 'Monterrey, Nuevo Leon', direccion: 'Av. Industria 100, Fierro, C.P. 64590', descripcion: 'Almacen' },
        citaCarga: '2026-11-25T14:00:00Z',
        citaDescarga: '2026-11-26T15:00:00Z',
        producto: 'Cemento gris',
        materialPeligroso: false,
        toneladasProgramadas: 30,
        referencia: 'OC-889',
        notas: 'Llevar lona',
        motivo: null,
        motivoNota: null,
        km: 812.5,
        ruta: {
          nombre: 'Apaseo - Monterrey',
          km: 812.5,
          tiempo: { horas: 9, minutos: 30 },
          paradas: [{ orden: 1, tipo: 'Descanso', referencia: 'Parador km 80', notas: null, direccion: null, lat: 19.5, lng: -99.2 }],
          plazasCobro: [{ orden: 1, nombre: 'Plaza Norte', autopista: 'Libramiento' }],
          ligaMapa: 'https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...',
        },
      },
    ],
    kmPlaneados: 852.5,
    tiempoEstimado: { horas: 9, minutos: 30 },
  },
};
