import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsPositive } from "class-validator";
import { TextoSignificativo } from "../common/validacion/texto-significativo";

export class DescartarSugerenciaDto {
  @ApiProperty({ example: "La muestra no es representativa y requiere ampliar el alcance." })
  @TextoSignificativo(10, "el motivo del descarte")
  motivo: string;
}

export class AnalizarEvidenciaDto {
  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  auditoriaId: number;

  @ApiProperty({ example: 15, description: "Evidencia adjunta a la auditoría seleccionada." })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  evidenciaId: number;
}
