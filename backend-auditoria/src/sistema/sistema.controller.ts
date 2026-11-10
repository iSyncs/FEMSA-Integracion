import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Publico, UsuarioActual } from '../auth/decoradores';
import { COOKIE_SESION, opcionesCookie, SesionesService } from '../auth/sesiones.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { verificarContrasena } from '../common/utils/contrasena';
import { EstadoDatos } from '../datos/repositorios/estado-datos';
import { CatalogosRepository, UsuariosRepository } from '../datos/repositorios/usuarios.repository';
import { IniciarSesionDto } from './sistema.dto';
import type { UsuarioSesion } from '../datos/repositorios/vistas';

@ApiTags('Sistema y sesión (HU_01)')
@Controller()
export class SistemaController {
  constructor(
    private readonly estadoDatos: EstadoDatos,
    private readonly usuarios: UsuariosRepository,
    private readonly catalogos: CatalogosRepository,
    private readonly bitacora: BitacoraService,
    private readonly sesiones: SesionesService,
  ) {}

  @Publico()
  @Get('health')
  @ApiOperation({ summary: 'Estado de la API y de la fuente de datos' })
  async health() {
    const inicio = performance.now();
    try {
      const info = await this.estadoDatos.estado();
      return {
        ok: true, motor: info.motor, servidor: 'NestJS', base: info.base, edicion: info.edicion,
        version: process.env.npm_package_version ?? '3.0.0', tablas_aud: info.tablas, hora_utc: new Date().toISOString(),
        latenciaMs: Math.round(performance.now() - inicio),
      };
    } catch (e) {
      return { ok: false, error: `Sin conexión con la base de datos: ${(e as Error).message}` };
    }
  }

  @Get('usuarios')
  @ApiOperation({ summary: 'Usuarios activos (requiere sesión)' })
  listarUsuarios() {
    return this.usuarios.listarActivos();
  }

  @Publico()
  @Post('sesion')
  @ApiOperation({ summary: 'Inicio de sesión con correo y contraseña; deja la sesión en una cookie HttpOnly de 8 horas' })
  async iniciar(@Body() dto: IniciarSesionDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const intento = `${req.ip ?? ''}|${dto.correo.trim().toLowerCase()}`;
    this.sesiones.revisarIntentos(intento);
    const cred = await this.usuarios.credencial(dto.correo);
    const valido = !!cred && await verificarContrasena(dto.contrasena, cred.contrasena_hash);
    const u = valido ? await this.usuarios.buscarActivo(cred.id) : null;
    // hu_15: cada intento de inicio de sesion queda en la bitacora, exitoso o no
    await this.bitacora.registrarAcceso({ usuario_id: u?.id ?? null, correo: dto.correo.trim().toLowerCase(), resultado: u ? 'exito' : 'fallo', ip: req.ip ?? null, agente: req.get('user-agent') ?? null, zona_horaria: dto.zonaHoraria ?? u?.zona_horaria ?? null });
    this.sesiones.registrarIntento(intento, !!u);
    if (!u) throw new UnauthorizedException('Correo o contraseña incorrectos.');
    res.cookie(COOKIE_SESION, await this.sesiones.abrir(u.id, req), opcionesCookie());
    return u;
  }

  @Get('sesion')
  @ApiOperation({ summary: 'Usuario de la sesión actual (401 si no hay sesión)' })
  actual(@UsuarioActual() usuario: UsuarioSesion) {
    return usuario;
  }

  @Publico()
  @Post('sesion/cerrar')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cierra la sesión: la revoca en la base y borra la cookie' })
  async cerrar(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const usuario = await this.sesiones.identificar(req).catch(() => null);
    await this.sesiones.cerrar(req);
    const { maxAge: _maxAge, ...opciones } = opcionesCookie();
    res.clearCookie(COOKIE_SESION, opciones);
    if (usuario) await this.bitacora.registrarAcceso({ usuario_id: usuario.id, correo: usuario.correo, resultado: 'cierre_sesion', ip: req.ip ?? null, agente: req.get('user-agent') ?? null, zona_horaria: usuario.zona_horaria });
  }

  @Get('catalogos')
  @ApiOperation({ summary: 'Unidades de negocio y controles con su riesgo' })
  async catalogosGenerales() {
    const [unidades, controles] = await Promise.all([this.catalogos.unidades(), this.catalogos.controles()]);
    return { unidades, controles };
  }
}
