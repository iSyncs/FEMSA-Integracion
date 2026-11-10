-- 004-user-password.sql
-- Equipo: 2
-- Viene de: Femsa-equipo-2 backend/src/datos/sql/scripts/user_password.sql
-- Estado: ya aplicada en E12_FEMSA
-- Toca tablas compartidas: sí: agrega password_hash a USER
-- Se puede correr dos veces: sí

-- Contraseñas de inicio de sesión: solo se guarda el hash bcrypt (60 caracteres), nunca la contraseña.
-- Se puede correr más de una vez.
IF COL_LENGTH('dbo.[USER]', 'password_hash') IS NULL
  ALTER TABLE dbo.[USER] ADD password_hash VARCHAR(100) NULL;
