import { salidaEjemplo } from '../../core/api/ejemplo/datos-ejemplo';
import { EstatusViaje, ReporteOperador, Viaje, ViajeCargado, ViajeVacio } from '../../core/api/operador-api.modelos';
import {
  BOTON_ESTATUS,
  ETIQUETA_ESTATUS,
  PASOS_CARGADO,
  ReporteParaGuia,
  esHito,
  esPasoDelOperador,
  guia,
  llegadaVacio,
  marcaDeGuia,
  operadorTermino,
  presentacionEstatus,
  pasosDisponibles,
  pasosOperador,
  rango,
  textoBoton,
  tituloViaje,
  viajeActivo,
  viajeQueToca,
} from './estatus-viaje.util';
import { CONTRASTE_MINIMO_SOL, contraste } from './contraste.util';

const salida = salidaEjemplo(new Date('2026-11-23T16:00:00Z'));
const [combustible, cargado1, cargado2, regresoTaller] = salida.viajes as [ViajeVacio, ViajeCargado, ViajeCargado, ViajeVacio];

let n = 0;
function rep(v: Viaje, estatus: EstatusViaje, estado = 'enviado', aviso: string | null = null): ReporteParaGuia {
  n++;
  const reporte: ReporteOperador = { tipo: 'estatus', id: `r${n}`, viajeId: v.id, estatus, ocurrioEn: `2026-11-23T16:${String(n).padStart(2, '0')}:00Z`, ubicacion: null, nota: null };
  return { reporte, estado, aviso };
}
const con = <T extends Viaje>(v: T, estatus: T['estatus']): T => ({ ...v, estatus });

describe('estatus-viaje.util: estatus del viaje y pasos del operador', () => {
  it('secuencia del viaje cargado y botones (texto → estatus)', () => {
    expect(PASOS_CARGADO).toEqual(['EnPosicionamiento', 'EnPatioOrigen', 'EnCarga', 'Documentado', 'EnTransito', 'EnPatioDestino', 'EnDescarga', 'Descargado']);
    expect(PASOS_CARGADO.map(textoBoton)).toEqual([
      'Voy a cargar',
      'Llegué a cargar',
      'Me están cargando',
      'Ya cargué y tengo documentos',
      'Voy en camino a descargar',
      'Llegué a descargar',
      'Me están descargando',
      'Ya descargué',
    ]);
    expect(BOTON_ESTATUS.Asignado).toBeUndefined();
    expect(BOTON_ESTATUS.Cerrado).toBeUndefined();
  });

  it('Asignado y Cerrado no los pone el operador', () => {
    for (const v of salida.viajes) {
      expect(esPasoDelOperador(v, 'Asignado')).toBe(false);
      expect(esPasoDelOperador(v, 'Cerrado')).toBe(false);
    }
    expect(esPasoDelOperador(cargado1, 'EnTransitoVacio')).toBe(false);
    expect(esPasoDelOperador(combustible, 'EnCarga')).toBe(false);
  });

  it('hitos: Documentado y Descargado', () => {
    expect(PASOS_CARGADO.filter(esHito)).toEqual(['Documentado', 'Descargado']);
  });

  it('vacío: "Salí" → EnTransitoVacio; "Llegué" → EnPatio, o EnTaller si el último tramo es a Taller', () => {
    expect(llegadaVacio(combustible)).toBe('EnPatio');
    expect(llegadaVacio(regresoTaller)).toBe('EnTaller');
    expect(pasosOperador(combustible)).toEqual(['EnTransitoVacio', 'EnPatio']);
    expect(pasosOperador(regresoTaller).map(textoBoton)).toEqual(['Salí', 'Llegué al taller']);
    expect(textoBoton('EnPatio')).toBe('Llegué');
    // El orden de los tramos manda, no el orden del arreglo.
    expect(llegadaVacio({ ...regresoTaller, tramos: [...regresoTaller.tramos].reverse() })).toBe('EnTaller');
  });

  it('rango: EnPatio y EnTaller comparten lugar; estatus ajeno al tipo = -1', () => {
    expect(rango('vacio', 'EnPatio')).toBe(rango('vacio', 'EnTaller'));
    expect(rango('vacio', 'Cerrado')).toBeGreaterThan(rango('vacio', 'EnTaller'));
    expect(rango('cargado', 'EnTaller')).toBe(-1);
    expect(rango('cargado', 'Cerrado')).toBe(9);
  });

  it('desde Asignado: el siguiente es "Voy a cargar" y se puede saltar a cualquiera hacia adelante', () => {
    expect(pasosDisponibles(cargado1, [])).toEqual(PASOS_CARGADO);
  });

  it('si la oficina ya avanzó, los pasos anteriores dejan de ofrecerse', () => {
    const v = con(cargado1, 'Documentado');
    expect(pasosDisponibles(v, [])).toEqual(['EnTransito', 'EnPatioDestino', 'EnDescarga', 'Descargado']);
    // Un reporte local más atrasado que lo que dice la oficina no cuenta.
    expect(guia(v, [rep(v, 'EnPatioOrigen', 'pendiente')])).toEqual({ estatus: 'Documentado', porReporte: false, estadoReporte: null });
  });

  it('lo que el operador ya reportó (aunque esté pendiente o por confirmar) guía hacia adelante', () => {
    expect(guia(cargado1, [rep(cargado1, 'EnCarga', 'pendiente')])).toEqual({ estatus: 'EnCarga', porReporte: true, estadoReporte: 'pendiente' });
    const hito = rep(cargado1, 'Documentado', 'por-confirmar');
    expect(pasosDisponibles(cargado1, [hito])[0]).toBe('EnTransito');
    expect(guia(cargado1, [hito]).estadoReporte).toBe('por-confirmar');
  });

  it('no cuentan los rechazados, los "sin efecto", los de otro viaje ni las incidencias', () => {
    const incidencia: ReporteParaGuia = {
      reporte: { tipo: 'incidencia', id: 'i', viajeId: cargado1.id, incidencia: 'FallaMecanica', ocurrioEn: '2026-11-23T16:00:00Z', ubicacion: null, nota: null },
      estado: 'enviado',
      aviso: null,
    };
    const reportes = [rep(cargado1, 'EnCarga', 'rechazado'), rep(cargado1, 'EnTransito', 'enviado', 'Ya estaba más adelante'), rep(cargado2, 'Descargado'), incidencia];
    expect(guia(cargado1, reportes).estatus).toBe('Asignado');
  });

  it('el operador termina en Descargado (cargado) o al llegar (vacío); Cerrado lo pone la oficina', () => {
    expect(operadorTermino(cargado1, [rep(cargado1, 'Descargado', 'por-confirmar')])).toBe(true);
    expect(operadorTermino(cargado1, [rep(cargado1, 'EnDescarga')])).toBe(false);
    expect(operadorTermino(regresoTaller, [rep(regresoTaller, 'EnTaller')])).toBe(true);
    expect(operadorTermino(con(combustible, 'EnPatio'), [])).toBe(true);
  });

  it('viaje que toca: el primero, en orden, con pasos pendientes; viaje activo para incidencias', () => {
    expect(viajeQueToca(salida, [])).toBe(combustible);
    const r1 = rep(combustible, 'EnPatio');
    expect(viajeQueToca(salida, [r1])).toBe(cargado1);
    // Viajes desordenados: manda el orden.
    expect(viajeQueToca({ ...salida, viajes: [regresoTaller, cargado2, cargado1, combustible] }, [])).toBe(combustible);
    // Todo reportado por el operador pero sin cerrar: no toca ninguno; el activo es el último sin cerrar.
    const todo = [r1, rep(cargado1, 'Descargado'), rep(cargado2, 'Descargado'), rep(regresoTaller, 'EnTaller')];
    expect(viajeQueToca(salida, todo)).toBeNull();
    expect(viajeActivo(salida, todo)).toBe(regresoTaller);
    // Todo cerrado: sin viaje activo.
    const cerrada = { ...salida, viajes: salida.viajes.map((v) => ({ ...v, estatus: 'Cerrado' as const })) };
    expect(viajeActivo(cerrada, [])).toBeNull();
    expect(viajeActivo(null, [])).toBeNull();
  });

  it('presentación del estatus: un solo util da texto y colores, todos con contraste ≥ 7:1 (pleno sol)', () => {
    const todos = Object.keys(ETIQUETA_ESTATUS) as EstatusViaje[];
    expect(todos).toHaveLength(13);
    for (const e of todos) {
      const p = presentacionEstatus(e);
      expect(p.texto).toBe(ETIQUETA_ESTATUS[e]);
      expect(contraste(p.fondo, p.tinta), e).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_SOL);
    }
  });

  it('presentación: color por etapa (camino, patio, maniobra, hito, taller, cerrado)', () => {
    const fondo = (e: EstatusViaje) => presentacionEstatus(e).fondo;
    expect(new Set(['EnPosicionamiento', 'EnTransito', 'EnTransitoVacio'].map((e) => fondo(e as EstatusViaje))).size).toBe(1);
    expect(new Set(['EnPatioOrigen', 'EnPatioDestino', 'EnPatio'].map((e) => fondo(e as EstatusViaje))).size).toBe(1);
    expect(fondo('EnCarga')).toBe(fondo('EnDescarga'));
    expect(fondo('Documentado')).toBe(fondo('Descargado'));
    const distintos = new Set(['Asignado', 'EnTransito', 'EnPatio', 'EnCarga', 'Documentado', 'EnTaller', 'Cerrado'].map((e) => fondo(e as EstatusViaje)));
    expect(distintos.size).toBe(7);
    expect(presentacionEstatus('EnTransitoVacio')).toEqual({ texto: 'En tránsito (vacío)', fondo: '#7a3400', tinta: '#ffffff' });
  });

  it('marca junto al estatus solo si viene de un reporte pendiente o por confirmar', () => {
    expect(marcaDeGuia({ estatus: 'EnCarga', porReporte: false, estadoReporte: null })).toBeNull();
    expect(marcaDeGuia({ estatus: 'EnCarga', porReporte: true, estadoReporte: 'pendiente' })).toBe('Pendiente de enviar');
    expect(marcaDeGuia({ estatus: 'Documentado', porReporte: true, estadoReporte: 'por-confirmar' })).toBe('Pendiente de confirmar por oficina');
    expect(marcaDeGuia({ estatus: 'EnCarga', porReporte: true, estadoReporte: 'enviado' })).toBeNull();
  });

  it('nombres para pantalla y título', () => {
    expect(ETIQUETA_ESTATUS.EnTransitoVacio).toBe('En tránsito (vacío)');
    expect(tituloViaje(cargado1)).toBe('Viaje 2 · Cargado · Apodaca, N.L. → Saltillo, Coah.');
    expect(tituloViaje(regresoTaller)).toBe('Viaje 4 · Vacío · San Luis Potosí, S.L.P. → Taller Diésel del Norte, Guadalupe, N.L.');
  });
});
