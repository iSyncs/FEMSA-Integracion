import { validarTexto } from './texto-significativo';

describe('validarTexto (retroalimentación SRS: campos con texto real)', () => {
  it('rechaza vacío y sólo espacios', () => {
    expect(validarTexto('', 5, 'el título')).toMatch(/Completa/);
    expect(validarTexto('      ', 5, 'el título')).toMatch(/Completa/);
  });

  it('rechaza texto de relleno', () => {
    expect(validarTexto('n/a', 3, 'la causa')).toMatch(/relleno/);
    expect(validarTexto('XXX', 3, 'la causa')).toMatch(/relleno/);
  });

  it('rechaza textos cortos o sin contenido alfanumérico', () => {
    expect(validarTexto('.....................', 20, 'la condición')).toMatch(/al menos 20/);
  });

  it('acepta texto significativo', () => {
    expect(validarTexto('Ajustes manuales sin soporte', 5, 'el título')).toBeNull();
  });
});
