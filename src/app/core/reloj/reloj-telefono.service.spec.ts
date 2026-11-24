import { TestBed } from '@angular/core/testing';
import { RELOJ } from '../plataforma';
import { RelojTelefonoService } from './reloj-telefono.service';

describe('RelojTelefonoService: aviso visible si la hora del teléfono está mal', () => {
  let ahora: Date;
  let s: RelojTelefonoService;

  beforeEach(() => {
    ahora = new Date('2026-11-23T20:12:00Z');
    TestBed.configureTestingModule({ providers: [{ provide: RELOJ, useValue: () => ahora }] });
    s = TestBed.inject(RelojTelefonoService);
  });

  it('con la hora del acuse calcula el desfase y avisa si va adelantado', () => {
    s.registrarHoraServidor('2026-11-23T20:05:00Z');
    expect(s.desfase()).toBe(7 * 60_000);
    expect(s.aviso()).toContain('adelantada unos 7 minutos');
  });

  it('hora bien: sin aviso; una hora del servidor inválida no cambia nada', () => {
    s.registrarHoraServidor('2026-11-23T20:11:58Z');
    expect(s.aviso()).toBeNull();
    s.registrarHoraServidor(null);
    expect(s.desfase()).toBe(2000);
  });

  it('rechazo por hora: avisa; cuando la hora se corrige, el aviso se quita', () => {
    s.registrarHoraRechazada();
    expect(s.aviso()).toContain('no aceptó un reporte');
    s.registrarHoraServidor('2026-11-23T20:12:00Z');
    expect(s.aviso()).toBeNull();
  });
});
