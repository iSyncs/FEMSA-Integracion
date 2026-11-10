import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class RecibirLoteDto {
  @ApiProperty({ example: 3 }) @Type(() => Number) @IsInt() @IsPositive()
  auditoriaId: number;

  @ApiPropertyOptional({ example: 1, description: 'Solicitud PBC que responde el lote.' })
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  solicitudPbcId?: number;

  @ApiProperty({ example: [63, 64], description: 'Evidencias ya cargadas que forman el lote.' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @Type(() => Number) @IsInt({ each: true }) @IsPositive({ each: true })
  evidencias: number[];

  @ApiPropertyOptional({ example: 'Respuesta a la solicitud de pagos a proveedores' })
  @IsOptional() @IsString() @MaxLength(300)
  asunto?: string;
}

export class SimularLoteDto {
  @ApiProperty({ example: 3 }) @Type(() => Number) @IsInt() @IsPositive()
  auditoriaId: number;
}

export class SolicitarPbcDto {
  @ApiProperty({ example: 3 }) @Type(() => Number) @IsInt() @IsPositive()
  auditoriaId: number;

  @ApiProperty({ example: 4 }) @Type(() => Number) @IsInt() @IsPositive()
  procedimientoId: number;
}
