import { paraProveedor, validar } from './esquema';
import { SKILLS } from './skills';

describe('validador de JSON de la IA (FE1S-23)', () => {
  const hallazgo = SKILLS.hallazgo.esquema;
  const valido = {
    titulo: 'Partidas sin depurar', condicion: 'Se identificaron 14 partidas con más de 90 días sin seguimiento documentado.',
    criterio: 'Política FIN-07 de conciliaciones', causa: 'No hubo reasignación del analista', efecto: 'Riesgo de saldos no reales',
    recomendacion: 'Depurar partidas y asignar responsable', severidad: 'Alta', impacto_mxn: 1284500, evidencia_citada: 'Conciliación agosto', confianza: 82,
  };

  it('acepta una sugerencia de hallazgo completa', () => expect(validar(valido, hallazgo)).toEqual([]));

  it('rechaza severidades fuera del catálogo, campos faltantes y campos extra', () => {
    const { causa: _causa, ...sinCausa } = valido;
    const errores = validar({ ...sinCausa, severidad: 'Urgente', extra: 1 }, hallazgo);
    expect(errores).toEqual(expect.arrayContaining(['$.causa: falta', '$.severidad: valor fuera del catálogo', '$.extra: campo no permitido']));
  });

  it('valida rangos y tipos', () => {
    expect(validar({ ...valido, confianza: 140 }, hallazgo)).toContain('$.confianza: mayor que 100');
    expect(validar({ ...valido, impacto_mxn: '10' }, hallazgo)).toContain('$.impacto_mxn: se esperaba un número');
    expect(validar({ ...valido, condicion: 'corta' }, hallazgo)).toContain('$.condicion: texto demasiado corto');
  });

  it('el esquema para el proveedor quita límites pero conserva estructura y catálogos', () => {
    const p = paraProveedor(hallazgo);
    expect(p.properties!.confianza).toEqual({ type: 'integer', description: 'Entero de 0 a 100' });
    expect(p.properties!.severidad.enum).toEqual(['Crítica', 'Alta', 'Moderada', 'Baja']);
    expect(p.required).toEqual(hallazgo.required);
    expect(JSON.stringify(p)).not.toMatch(/minLength|maxLength|minimum|maximum|maxItems/);
  });

  it('cada skill pide todos sus campos y no admite extras (requisito del modo estricto)', () => {
    for (const s of Object.values(SKILLS)) {
      expect(s.esquema.additionalProperties).toBe(false);
      expect([...(s.esquema.required ?? [])].sort()).toEqual(Object.keys(s.esquema.properties ?? {}).sort());
    }
  });
});
