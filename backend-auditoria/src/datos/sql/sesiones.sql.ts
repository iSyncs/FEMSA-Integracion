import { Injectable } from "@nestjs/common";
import { ConexionSql } from "./conexion-sql";
import { NuevaSesion, SesionesRepository } from "../repositorios/sesiones.repository";

/** Tabla dbo.USER_SESSION (migración: db/migrations/005-user-session.sql). */
@Injectable()
export class SesionesSqlRepository extends SesionesRepository {
  constructor(private readonly db: ConexionSql) {
    super();
  }

  async crear(s: NuevaSesion) {
    await this.db.consulta(
      `
      INSERT INTO dbo.USER_SESSION (user_id, token_hash, expires_at, ip, user_agent)
      VALUES (@usuario, @hash, @expira, @ip, @agente)`,
      {
        usuario: s.usuarioId,
        hash: s.tokenHash,
        expira: s.expira,
        ip: s.ip?.slice(0, 64) ?? null,
        agente: s.agente?.slice(0, 300) ?? null,
      },
    );
  }

  async usuarioDe(tokenHash: string, ahora: Date) {
    const [f] = await this.db.consulta<{ id: number }>(
      `
      SELECT user_id AS id FROM dbo.USER_SESSION
       WHERE token_hash = @hash AND revoked_at IS NULL AND expires_at > @ahora`,
      { hash: tokenHash, ahora },
    );
    return f?.id ?? null;
  }

  async revocar(tokenHash: string) {
    await this.db.consulta(
      "UPDATE dbo.USER_SESSION SET revoked_at = SYSUTCDATETIME() WHERE token_hash = @hash AND revoked_at IS NULL",
      { hash: tokenHash },
    );
  }
}
