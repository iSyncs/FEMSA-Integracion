import { SEMANAS, contarPor, cumplimiento, diasEntre, ordenarPorSeveridad, porSemana } from './agregados';

describe('agregados del tablero (HU_14)', () => {
  it('contarPor devuelve todas las claves en orden, aunque estén en 0', () => {
    const r = contarPor([{ s: 'Alta' }, { s: 'Alta' }, { s: 'Baja' }], ['Crítica', 'Alta', 'Moderada', 'Baja'] as const, (x) => x.s as 'Alta' | 'Baja');
    expect(r).toEqual([{ clave: 'Crítica', total: 0 }, { clave: 'Alta', total: 2 }, { clave: 'Moderada', total: 0 }, { clave: 'Baja', total: 1 }]);
  });

  it('porSemana arma 8 cubos (semanasAtras 7..0) y descarta lo más antiguo', () => {
    const ahora = new Date('2026-10-02T12:00:00Z');
    const dia = 86_400_000;
    const r = porSemana([new Date(+ahora - dia), new Date(+ahora - 8 * dia), new Date(+ahora - 100 * dia)], ahora);
    expect(r).toHaveLength(SEMANAS);
    expect(r[0].semanasAtras).toBe(7);
    expect(r[SEMANAS - 1]).toEqual({ semanasAtras: 0, total: 1 });
    expect(r[SEMANAS - 2]).toEqual({ semanasAtras: 1, total: 1 });
    expect(r.reduce((s, c) => s + c.total, 0)).toBe(2);
  });

  it('cumplimiento no divide entre cero', () => {
    expect(cumplimiento(0, 0)).toBe(0);
    expect(cumplimiento(1, 3)).toBe(33);
  });

  it('diasEntre cuenta días completos y devuelve null sin fecha de partida', () => {
    const ahora = new Date('2026-10-02T12:00:00Z');
    expect(diasEntre(new Date('2026-10-02T01:00:00Z'), ahora)).toBe(0);
    expect(diasEntre(new Date('2026-09-29T12:00:00Z'), ahora)).toBe(3);
    expect(diasEntre(null, ahora)).toBeNull();
  });

  it('ordenarPorSeveridad pone Crítica primero y, a igualdad, el más antiguo', () => {
    const r = ordenarPorSeveridad([
      { id: 1, severidad: 'Baja' as const, fecha_identificacion: new Date('2026-01-01') },
      { id: 2, severidad: 'Crítica' as const, fecha_identificacion: new Date('2026-05-01') },
      { id: 3, severidad: 'Crítica' as const, fecha_identificacion: new Date('2026-03-01') },
    ]);
    expect(r.map((x) => x.id)).toEqual([3, 2, 1]);
  });
});
