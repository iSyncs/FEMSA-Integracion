import { semaforo } from './semaforo';
import { hoyEn } from '../common/utils/fechas';

describe('semáforo de cumplimiento (HU_10)', () => {
  const ahora = new Date('2026-09-27T18:00:00Z');
  const base = { estado: 'en_progreso' as const, avance_pct: 40, fecha_conclusion: null, zona_horaria: 'America/Mexico_City' };

  it('respeta la zona horaria de la unidad de negocio', () => {
    const instante = new Date('2026-09-28T02:00:00Z');
    expect(hoyEn('America/Monterrey', instante)).toBe('2026-09-27');
    expect(hoyEn('Europe/Zurich', instante)).toBe('2026-09-28');
  });

  it('clasifica en tiempo, por vencer y demorado', () => {
    expect(semaforo({ ...base, fecha_compromiso: new Date('2026-10-20') }, ahora).semaforo).toBe('en_tiempo');
    expect(semaforo({ ...base, fecha_compromiso: new Date('2026-09-30') }, ahora).semaforo).toBe('por_vencer');
    expect(semaforo({ ...base, fecha_compromiso: new Date('2026-09-20') }, ahora).semaforo).toBe('demorado');
  });

  it('un plan concluido antes de su fecha queda en tiempo; uno cerrado, cerrado', () => {
    expect(semaforo({ ...base, avance_pct: 100, fecha_conclusion: new Date('2026-09-19T12:00:00Z'), fecha_compromiso: new Date('2026-09-20') }, ahora).semaforo).toBe('en_tiempo');
    expect(semaforo({ ...base, estado: 'cerrado', fecha_compromiso: new Date('2026-09-20') }, ahora).semaforo).toBe('cerrado');
  });
});
