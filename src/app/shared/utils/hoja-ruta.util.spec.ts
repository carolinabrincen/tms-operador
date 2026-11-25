import { avisoOtraSalida, detalleLugar, fechaSinHora, ligaTelefono, textoKm, textoParada, textoTiempo, textoToneladas } from './hoja-ruta.util';

describe('hoja-ruta.util: la hoja en pantalla', () => {
  it('teléfonos: liga tel: para llamar al tocar (solo dígitos y un + inicial)', () => {
    expect(ligaTelefono('55 1234 5678')).toBe('tel:5512345678');
    expect(ligaTelefono('800 123 4567')).toBe('tel:8001234567');
    expect(ligaTelefono('+52 (81) 1234-5678')).toBe('tel:+528112345678');
    expect(ligaTelefono('ext 12')).toBeNull();
    expect(ligaTelefono(null)).toBeNull();
  });

  it('fin estimado es solo fecha: dd/MM/yyyy sin convertir de zona', () => {
    expect(fechaSinHora('2026-11-27')).toBe('27/11/2026');
    expect(fechaSinHora('mañana')).toBe('mañana');
    expect(fechaSinHora(null)).toBe('');
  });

  it('tiempo, kilómetros y toneladas', () => {
    expect(textoTiempo({ horas: 9, minutos: 30 })).toBe('9 h 30 min');
    expect(textoTiempo({ horas: 0, minutos: 45 })).toBe('45 min');
    expect(textoTiempo({ horas: 2, minutos: 0 })).toBe('2 h');
    expect(textoTiempo(null)).toBe('');
    expect(textoKm(812.5)).toBe('812.5 km');
    expect(textoKm(1075.5)).toBe('1,075.5 km');
    expect(textoToneladas(30)).toBe('30 t');
  });

  it('paradas autorizadas por nombre', () => {
    expect(['Descanso', 'CambioChofer', 'CargaDiesel', 'Resguardo', 'Otro'].map((t) => textoParada(t as never))).toEqual([
      'Descanso',
      'Cambio de chofer',
      'Carga de diésel',
      'Resguardo',
      'Otra parada',
    ]);
  });

  it('dirección y descripción del lugar solo si vienen', () => {
    expect(detalleLugar({ lugar: 'Apaseo', direccion: 'Carretera 45 km 3', descripcion: 'Planta' })).toBe('Planta · Carretera 45 km 3');
    expect(detalleLugar({ lugar: 'Base', direccion: null, descripcion: null })).toBe('');
  });

  it('avisa si la hoja guardada es de otra salida', () => {
    expect(avisoOtraSalida('DSP-1', 'DSP-1')).toBeNull();
    expect(avisoOtraSalida('DSP-1', null)).toBeNull();
    expect(avisoOtraSalida('DSP-1', 'DSP-2')).toBe('Esta hoja es de la salida DSP-1, pero su salida actual es DSP-2. Actualice con señal.');
  });
});
