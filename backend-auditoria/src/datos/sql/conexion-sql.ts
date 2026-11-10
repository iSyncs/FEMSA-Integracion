import { Injectable, OnModuleDestroy } from '@nestjs/common';
import sql from 'mssql';

export type Parametros = Record<string, unknown>;

export interface Ejecutor {
  consulta<T = Record<string, unknown>>(texto: string, parametros?: Parametros): Promise<T[]>;
}

function preparar(req: sql.Request, parametros: Parametros = {}) {
  for (const [nombre, valor] of Object.entries(parametros)) {
    // Las fechas viajan como DATETIME2: con DATETIME se redondean los milisegundos y cambiaría el hash del sellado.
    if (valor instanceof Date) req.input(nombre, sql.DateTime2(7), valor);
    else req.input(nombre, valor as never);
  }
  return req;
}

/** Pool de Azure SQL / SQL Server. Se conecta hasta la primera consulta. */
@Injectable()
export class ConexionSql implements OnModuleDestroy, Ejecutor {
  private pool: Promise<sql.ConnectionPool> | null = null;

  private obtener() {
    this.pool ??= new sql.ConnectionPool({
      server: process.env.DB_HOST ?? '',
      port: Number(process.env.DB_PORT ?? 1433),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: { encrypt: true, trustServerCertificate: process.env.DB_TRUST_CERT === 'true' },
      // Azure SQL serverless puede tardar casi un minuto en despertar.
      connectionTimeout: 90_000,
      requestTimeout: 60_000,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    }).connect().catch((e) => { this.pool = null; throw e; });
    return this.pool;
  }

  async consulta<T = Record<string, unknown>>(texto: string, parametros?: Parametros): Promise<T[]> {
    const pool = await this.obtener();
    return (await preparar(pool.request(), parametros).query(texto)).recordset as T[];
  }

  async transaccion<T>(trabajo: (tx: Ejecutor) => Promise<T>): Promise<T> {
    const pool = await this.obtener();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const ejecutor: Ejecutor = {
      consulta: async <R>(texto: string, parametros?: Parametros) =>
        (await preparar(new sql.Request(tx), parametros).query(texto)).recordset as R[],
    };
    try {
      const r = await trabajo(ejecutor);
      await tx.commit();
      return r;
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  async onModuleDestroy() {
    if (this.pool) await (await this.pool).close().catch(() => undefined);
  }
}

/** Siguiente folio de negocio (AUD-000001, FND-000001…). Se llama dentro de una transacción. */
export async function siguienteFolio(tx: Ejecutor, tabla: string, prefijo: string) {
  const [r] = await tx.consulta<{ n: number }>(
    `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(tracking_id, ${prefijo.length + 2}, 20) AS INT)), 0) + 1 AS n
       FROM dbo.[${tabla}] WITH (UPDLOCK, HOLDLOCK) WHERE tracking_id LIKE @patron`,
    { patron: `${prefijo}-%` },
  );
  return `${prefijo}-${String(r.n).padStart(6, '0')}`;
}
