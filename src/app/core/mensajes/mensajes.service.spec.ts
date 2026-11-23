import { TestBed } from '@angular/core/testing';
import { MensajesService } from './mensajes.service';

describe('MensajesService: mensaje visible en pantalla', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra, reemplaza y se cierra solo', () => {
    vi.useFakeTimers();
    const m = TestBed.inject(MensajesService);
    m.mostrar('Uno');
    expect(m.mensaje()).toMatchObject({ texto: 'Uno', tipo: 'info' });
    m.mostrar('Dos', 'error', 1000);
    expect(m.mensaje()).toMatchObject({ texto: 'Dos', tipo: 'error' });
    vi.advanceTimersByTime(999);
    expect(m.mensaje()?.texto).toBe('Dos');
    vi.advanceTimersByTime(1);
    expect(m.mensaje()).toBeNull();
  });

  it('cerrar con un id viejo no cierra el mensaje nuevo', () => {
    const m = TestBed.inject(MensajesService);
    m.mostrar('Uno');
    const viejo = m.mensaje()!.id;
    m.mostrar('Dos');
    m.cerrar(viejo);
    expect(m.mensaje()?.texto).toBe('Dos');
    m.cerrar();
    expect(m.mensaje()).toBeNull();
  });
});
