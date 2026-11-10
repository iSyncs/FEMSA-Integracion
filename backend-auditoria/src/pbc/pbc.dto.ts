import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, Matches, MaxLength, MinLength, ValidateNested,
} from 'class-validator';

export const ESTADOS_PBC = ['solicitada', 'enviada', 'reenviar', 'completa'] as const;

export class PuntoSolicitadoDto {
  @ApiProperty({ example: 'Autorizaciones de pago de septiembre firmadas por el gerente' })
  @IsString() @MinLength(3) @MaxLength(300)
  descripcion: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  obligatorio?: boolean;
}

export class CrearSolicitudPbcDto {
  @ApiProperty({ example: 2 }) @Type(() => Number) @IsInt() @IsPositive()
  auditoriaId: number;

  @ApiProperty({ example: 4 }) @Type(() => Number) @IsInt() @IsPositive()
  procedimientoId: number;

  @ApiProperty({ example: 12, description: 'Usuario auditado que debe responder' }) @Type(() => Number) @IsInt() @IsPositive()
  solicitadoAId: number;

  @ApiProperty({ example: '2026-11-20', description: 'Fecha límite (AAAA-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Usa el formato AAAA-MM-DD.' })
  fechaLimite: string;

  @ApiProperty({ example: 'Soporte de pagos a proveedores de septiembre' }) @IsString() @MinLength(3) @MaxLength(300)
  asunto: string;

  @ApiProperty({ type: [PuntoSolicitadoDto] })
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos un punto.' }) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => PuntoSolicitadoDto)
  puntos: PuntoSolicitadoDto[];
}

export class ConsultarSolicitudesPbcDto {
  @ApiPropertyOptional({ example: 2 }) @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  auditoriaId?: number;

  @ApiPropertyOptional({ enum: ESTADOS_PBC }) @IsOptional() @IsIn(ESTADOS_PBC)
  estado?: (typeof ESTADOS_PBC)[number];
}

export class PuntoRevisadoDto {
  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @IsPositive()
  id: number;

  @ApiProperty({ enum: ['cubierto', 'faltante'] }) @IsIn(['cubierto', 'faltante'])
  estado: 'cubierto' | 'faltante';
}

export class RevisarSolicitudPbcDto {
  @ApiProperty({ enum: ['completa', 'reenviar'] }) @IsIn(['completa', 'reenviar'])
  decision: 'completa' | 'reenviar';

  @ApiPropertyOptional({ example: 'Falta la autorización del pago 4512.' }) @IsOptional() @IsString() @MaxLength(500)
  comentario?: string;

  @ApiPropertyOptional({ type: [PuntoRevisadoDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => PuntoRevisadoDto)
  puntos?: PuntoRevisadoDto[];
}
