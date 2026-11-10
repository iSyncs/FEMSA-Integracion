import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class IniciarSesionDto {
  @ApiProperty({ example: 'jose.martinez@demo.femsa.test' })
  @IsEmail({}, { message: 'Escribe un correo válido.' }) @MaxLength(200)
  correo: string;

  @ApiProperty({ example: '********' })
  @IsString() @IsNotEmpty({ message: 'Escribe tu contraseña.' }) @MaxLength(200)
  contrasena: string;

  @ApiProperty({ required: false, example: 'America/Monterrey' }) @IsOptional() @IsString() zonaHoraria?: string;
}
