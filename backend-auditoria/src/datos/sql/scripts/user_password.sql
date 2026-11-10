-- Contraseñas de inicio de sesión: solo se guarda el hash bcrypt (60 caracteres), nunca la contraseña.
-- Se puede correr más de una vez.
IF COL_LENGTH('dbo.[USER]', 'password_hash') IS NULL
  ALTER TABLE dbo.[USER] ADD password_hash VARCHAR(100) NULL;
