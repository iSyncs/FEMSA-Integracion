import { BaseDeDatosMemoria } from '../datos/memoria/base-de-datos-memoria';
import { BitacoraMemoriaRepository } from '../datos/memoria/bitacora.memoria';
import type { Contexto } from '../auth/decoradores';
import type { UsuarioSesion } from '../datos/repositorios/vistas';
import { BitacoraService, cambiosDe } from './bitacora.service';

const DIA = 86_400_000;
const director = { id: 10, nombre: 'D. Herrera', correo: 'd.herrera@demo.femsa.test', rol: 'director' } as UsuarioSesion;
const ctx: Contexto = { usuario: director, ip: '10.0.0.5', zonaHoraria: 'America/Monterrey' };

describe('BitacoraService (HU_15)', () => {
  let servicio: BitacoraService;

  beforeEach(() => {
    servicio = new BitacoraService(new BitacoraMemoriaRepository(new BaseDeDatosMemoria()));
  });

  it('registra un intento de acceso con ip, navegador, zona horaria y fecha utc', async () => {
    await servicio.registrarAcceso({ usuario_id: 10, correo: director.correo, resultado: 'fallo', ip: '10.0.0.5', agente: 'Firefox 140', zona_horaria: 'America/Monterrey' });
    const { accesos } = await servicio.consultar({ usuarioId: 10 });
    expect(accesos[0]).toMatchObject({ resultado: 'fallo', ip: '10.0.0.5', agente: 'Firefox 140', zona_horaria: 'America/Monterrey', usuario: 'D. Herrera' });
    expect(Date.now() - accesos[0].fecha.getTime()).toBeLessThan(5000);
  });

  it('registra una operacion con folio, valor anterior y valor nuevo', async () => {
    await servicio.registrarOperacion(ctx, { entidad: 'planes', entidadId: 1, folio: 'RP-000001', accion: 'ACTUALIZAR', anterior: { avance_pct: 20 }, nuevo: { avance_pct: 50 } });
    const { operaciones } = await servicio.consultar({ folio: 'RP-000001' });
    expect(operaciones).toHaveLength(1);
    expect(operaciones[0]).toMatchObject({ accion: 'ACTUALIZAR', usuario_id: 10, ip: '10.0.0.5', zona_horaria: 'America/Monterrey' });
    expect(JSON.parse(operaciones[0].detalle!)).toEqual({ anterior: { avance_pct: 20 }, nuevo: { avance_pct: 50 } });
  });

  it('oculta accesos de mas de 30 dias y operaciones de mas de 90', async () => {
    await servicio.registrarAcceso({ usuario_id: 10, correo: null, resultado: 'exito', ip: null, agente: null, zona_horaria: null });
    await servicio.registrarOperacion(ctx, { entidad: 'hallazgos', entidadId: 1, folio: 'FND-999999', accion: 'CREAR' });
    const filtro = { usuarioId: 10, folio: 'FND-999999' };

    const en31Dias = await servicio.consultar(filtro, new Date(Date.now() + 31 * DIA));
    expect(en31Dias.accesos).toHaveLength(0);
    expect(en31Dias.operaciones).toHaveLength(1);

    const en91Dias = await servicio.consultar(filtro, new Date(Date.now() + 91 * DIA));
    expect(en91Dias.operaciones).toHaveLength(0);
  });

  it('pagina los resultados', async () => {
    for (let i = 0; i < 3; i++) await servicio.registrarOperacion(ctx, { entidad: 'hallazgos', entidadId: i, folio: `FND-90000${i}`, accion: 'CREAR' });
    const r = await servicio.consultar({ folio: 'FND-90000', limite: 2, pagina: 2 });
    expect(r.operaciones).toHaveLength(1);
    expect(r.totales.operaciones).toBe(3);
  });

  it('no tiene metodos para editar ni borrar registros', () => {
    const prohibidos = /actualizar|editar|modificar|eliminar|borrar|update|delete|remove/i;
    const metodos = [
      ...Object.getOwnPropertyNames(BitacoraService.prototype),
      ...Object.getOwnPropertyNames(BitacoraMemoriaRepository.prototype),
    ];
    expect(metodos.filter((m) => prohibidos.test(m))).toEqual([]);
  });
});

describe('FE1S-36 · cambiosDe', () => {
  it('compara anterior y nuevo y omite lo que no cambió', () => {
    expect(cambiosDe(JSON.stringify({ anterior: { estado: 'abierto', avance_pct: 20 }, nuevo: { estado: 'abierto', avance_pct: 50 } })))
      .toEqual([{ campo: 'avance_pct', antes: 20, despues: 50 }]);
  });

  it('un detalle plano se muestra como valores nuevos', () => {
    expect(cambiosDe(JSON.stringify({ etapa: 'grc', decision: 'rechazado' })))
      .toEqual([{ campo: 'etapa', antes: null, despues: 'grc' }, { campo: 'decision', antes: null, despues: 'rechazado' }]);
  });

  it('tolera detalle vacío o texto que no es JSON', () => {
    expect(cambiosDe(null)).toEqual([]);
    expect(cambiosDe('texto libre')).toEqual([{ campo: 'detalle', antes: null, despues: 'texto libre' }]);
  });
});
