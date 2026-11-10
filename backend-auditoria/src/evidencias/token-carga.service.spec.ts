import { TokenCargaService } from './token-carga.service';

describe('TokenCargaService', () => {
  it('acepta el token firmado y rechaza alteraciones', () => {
    const s = new TokenCargaService();
    const token = s.firmar({ usuarioId: 1, auditoriaId: 2, procedimientoId: 4, solicitudPbcId: null, reemplazaId: null,
      nombre: 'prueba.pdf', mime: 'application/pdf', tamano: 10, blob: '2/id.pdf' });
    expect(s.verificar(token)).toMatchObject({ usuarioId: 1, blob: '2/id.pdf' });
    expect(() => s.verificar(`${token.slice(0, -1)}x`)).toThrow('inválido');
  });
});
