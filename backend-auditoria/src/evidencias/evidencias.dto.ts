import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMimeType, IsOptional, IsPositive, IsString, Max, MaxLength, ValidateIf } from 'class-validator';

export class IniciarCargaDto {
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() auditoriaId: number;
  @ApiProperty({ required: false }) @ValidateIf((o: IniciarCargaDto) => !o.solicitudPbcId) @Type(() => Number) @IsInt() @IsPositive() procedimientoId?: number;
  @ApiProperty({ required: false }) @ValidateIf((o: IniciarCargaDto) => !o.procedimientoId) @Type(() => Number) @IsInt() @IsPositive() solicitudPbcId?: number;
  @ApiProperty({ example: 'papel_trabajo.pdf' }) @IsString() @MaxLength(255) nombreArchivo: string;
  @ApiProperty({ example: 'application/pdf' }) @IsMimeType() @MaxLength(100) tipoMime: string;
  @ApiProperty({ example: 120000 }) @Type(() => Number) @IsInt() @IsPositive() @Max(104_857_600) tamanoBytes: number;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() @IsPositive() reemplazaId?: number;
}

export class ConfirmarCargaDto {
  @ApiProperty() @IsString() token: string;
}
