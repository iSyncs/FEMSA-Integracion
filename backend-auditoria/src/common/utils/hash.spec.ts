import { canonico, sha256 } from './hash';

describe('manifiesto canónico + SHA-256 (HU_08)', () => {
  it('el hash no depende del orden de las llaves', () => {
    const a = { hallazgos: [{ titulo: 'X', severidad: 'Alta' }], fecha: new Date('2026-01-01T00:00:00Z') };
    const b = { fecha: new Date('2026-01-01T00:00:00Z'), hallazgos: [{ severidad: 'Alta', titulo: 'X' }] };
    expect(sha256(canonico(a))).toBe(sha256(canonico(b)));
  });

  it('detecta cualquier cambio en el contenido', () => {
    const a = { hallazgos: [{ titulo: 'X' }] };
    expect(sha256(canonico(a))).not.toBe(sha256(canonico({ hallazgos: [{ titulo: 'Y' }] })));
    expect(sha256('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
