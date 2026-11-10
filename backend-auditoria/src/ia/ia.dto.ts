import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

// Límites por petición: evitan mandar documentos enormes al proveedor y gastar de más.
const MAX_CONTENIDO = 12_000;
const MAX_DOCUMENTOS = 10;

export class DocumentoDto {
  @ApiProperty({ example: "Conciliacion_bancaria_sep.xlsx" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre: string;

  @ApiProperty({ required: false, description: "Texto extraído del documento" })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENIDO, { message: `El contenido de cada documento admite hasta ${MAX_CONTENIDO} caracteres.` })
  contenido?: string;
}

export class ContextoDto {
  @ApiProperty({ required: false, example: "AUD-000002 · Tesorería" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  auditoria?: string;
  @ApiProperty({ required: false, example: "FEMSA Servicios" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  unidad?: string;
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  procedimientos?: string[];
}

export class ClasificarDto {
  @ApiProperty({ type: DocumentoDto }) @ValidateNested() @Type(() => DocumentoDto) documento: DocumentoDto;
  @ApiProperty({ required: false, type: ContextoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextoDto)
  contexto?: ContextoDto;
}

export class CompletitudDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: "Indica al menos un documento requerido." })
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  requeridos: string[];

  @ApiProperty({ type: [DocumentoDto] })
  @IsArray()
  @ArrayMaxSize(MAX_DOCUMENTOS)
  @ValidateNested({ each: true })
  @Type(() => DocumentoDto)
  documentos: DocumentoDto[];

  @ApiProperty({ required: false, type: ContextoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextoDto)
  contexto?: ContextoDto;
}

export class HallazgoIaDto {
  @ApiProperty({ type: [DocumentoDto] })
  @IsArray()
  @ArrayMinSize(1, { message: "Agrega al menos una evidencia." })
  @ArrayMaxSize(MAX_DOCUMENTOS)
  @ValidateNested({ each: true })
  @Type(() => DocumentoDto)
  evidencias: DocumentoDto[];

  @ApiProperty({ required: false, type: ContextoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextoDto)
  contexto?: ContextoDto;
}

class HallazgoBaseDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(300) titulo: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) condicion?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) causa?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) recomendacion?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(["Crítica", "Alta", "Moderada", "Baja"]) severidad?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() impacto_mxn?: number | null;
}

export class PlanIaDto {
  @ApiProperty({ type: HallazgoBaseDto }) @ValidateNested() @Type(() => HallazgoBaseDto) hallazgo: HallazgoBaseDto;
}

class HallazgoResumenDto {
  @ApiProperty() @IsString() @MaxLength(300) titulo: string;
  @ApiProperty() @IsIn(["Crítica", "Alta", "Moderada", "Baja"]) severidad: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) estado?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() impacto_mxn?: number | null;
}

export class ResumenIaDto {
  @ApiProperty({ example: "AUD-000002 · Tesorería FEMSA Servicios" })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  auditoria: string;
  @ApiProperty({ type: [HallazgoResumenDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => HallazgoResumenDto)
  hallazgos: HallazgoResumenDto[];
}
