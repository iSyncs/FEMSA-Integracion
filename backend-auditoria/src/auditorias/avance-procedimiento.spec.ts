import { avanceProcedimiento } from './auditorias.service';

describe('avanceProcedimiento (F_02)', () => {
  it.each([
    ['abierto', false, 0],
    ['abierto', true, 20],
    ['rechazado', true, 40],
    ['evaluado', true, 70],
    ['revisado', true, 80],
    ['supervisado', true, 100],
  ])('mapea %s con captura %s al porcentaje esperado', (estado, captura, esperado) => {
    expect(avanceProcedimiento(estado, captura)).toBe(esperado);
  });
});
