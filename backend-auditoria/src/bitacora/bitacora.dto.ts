import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export const ACCIONES = [
  "CREAR",
  "ACTUALIZAR",
  "APROBAR",
  "RECHAZAR",
  "CERRAR",
  "EXPORTAR",
  "SOLICITAR_CIERRE",
  "VALIDACION",
  "EVALUAR",
] as const;
export type AccionBitacora = (typeof ACCIONES)[number];

export const ENTIDADES = [
  "auditorias",
  "procedimientos_auditoria",
  "evidencias",
  "hallazgos",
  "planes",
  "aprobaciones",
  "solicitudes_pbc",
  "lotes",
  "sugerencias_ia",
] as const;
export const RESULTADOS_ACCESO = ["exito", "fallo", "denegado", "cierre_sesion"] as const;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// hu_15: filtros opcionales, sin filtros regresa todo lo que sigue en retencion
export class ConsultarBitacoraDto {
  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  usuarioId?: number;

  @ApiProperty({ required: false, example: "2026-09-01", description: "Fecha inicial en UTC (YYYY-MM-DD)" })
  @IsOptional()
  @Matches(FECHA, { message: "Usa el formato AAAA-MM-DD." })
  desde?: string;

  @ApiProperty({ required: false, example: "2026-09-30", description: "Fecha final en UTC (YYYY-MM-DD), incluida" })
  @IsOptional()
  @Matches(FECHA, { message: "Usa el formato AAAA-MM-DD." })
  hasta?: string;

  @ApiProperty({ required: false, enum: ACCIONES })
  @IsOptional()
  @IsIn(ACCIONES, { message: "Acción no válida." })
  accion?: AccionBitacora;

  @ApiProperty({ required: false, example: "FND-000001" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  folio?: string;

  @ApiProperty({ required: false, example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiProperty({ required: false, example: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}

/** FE1S-36 · Feed de operaciones: filtros que se resuelven en la base. */
export class ConsultarOperacionesDto extends ConsultarBitacoraDto {
  @ApiProperty({ required: false, enum: ENTIDADES })
  @IsOptional()
  @IsIn(ENTIDADES, { message: "Entidad no válida." })
  entidad?: (typeof ENTIDADES)[number];

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  auditoriaId?: number;

  @ApiProperty({ required: false, example: "RP-000008", description: "Busca en folio, usuario y auditoría" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  texto?: string;
}

export class ConsultarAccesosDto extends ConsultarBitacoraDto {
  @ApiProperty({ required: false, enum: RESULTADOS_ACCESO })
  @IsOptional()
  @IsIn(RESULTADOS_ACCESO, { message: "Resultado no válido." })
  resultado?: (typeof RESULTADOS_ACCESO)[number];

  @ApiProperty({ required: false, example: "ramos", description: "Busca en usuario, correo e IP" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  texto?: string;
}

export class ExportarBitacoraDto extends ConsultarOperacionesDto {
  @ApiProperty({ required: false, enum: ["operaciones", "accesos"], default: "operaciones" })
  @IsOptional()
  @IsIn(["operaciones", "accesos"])
  tipo?: "operaciones" | "accesos";

  @ApiProperty({ required: false, enum: RESULTADOS_ACCESO })
  @IsOptional()
  @IsIn(RESULTADOS_ACCESO)
  resultado?: (typeof RESULTADOS_ACCESO)[number];

  @ApiProperty({
    required: false,
    example: "fecha_utc,usuario,accion",
    description: "Columnas a incluir, separadas por coma. Sin valor: todas.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z_]+(,[a-z_]+)*$/, { message: "columnas debe ser una lista separada por comas" })
  columnas?: string;
}
