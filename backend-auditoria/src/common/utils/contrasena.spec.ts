import { hashContrasena, verificarContrasena } from './contrasena';

describe('contraseñas', () => {
  it('guarda un hash bcrypt y verifica la contraseña correcta', async () => {
    const h = hashContrasena('Secreta-123');
    expect(h).toMatch(/^\$2[aby]\$10\$/);
    expect(h).not.toContain('Secreta-123');
    await expect(verificarContrasena('Secreta-123', h)).resolves.toBe(true);
    await expect(verificarContrasena('secreta-123', h)).resolves.toBe(false);
  });

  it('rechaza usuarios sin contraseña o con formato desconocido', async () => {
    await expect(verificarContrasena('x', null)).resolves.toBe(false);
    await expect(verificarContrasena('x', 'md5$abc$def')).resolves.toBe(false);
  });
});
