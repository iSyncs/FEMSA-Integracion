-- 01-tablas-compartidas.sql · ROLE, USER, PERMISSION y ROLE_PERMISSION
-- Viene de: hectorpablogzz/auditoria_bd@3124744 scripts/tablas_compartidas.sql
-- Base inicial: ya existe en E12_FEMSA. Solo para crear una base nueva desde cero. NO se puede correr dos veces.

--Tabla ROLE --
CREATE TABLE dbo.[ROLE]
(
    role_id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(200) NOT NULL,

    CONSTRAINT PK_ROLE
        PRIMARY KEY (role_id)
);

--Tabla USER --
CREATE TABLE dbo.[USER]
(
    user_id INT IDENTITY(1,1) NOT NULL,
    entra_id UNIQUEIDENTIFIER NOT NULL,
    email VARCHAR(200) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    role_id INT NOT NULL,

    CONSTRAINT PK_USER
        PRIMARY KEY (user_id),

    CONSTRAINT UQ_USER_ENTRA_ID
        UNIQUE (entra_id),

    CONSTRAINT UQ_USER_EMAIL
        UNIQUE (email),

    CONSTRAINT FK_USER_ROLE
        FOREIGN KEY (role_id)
        REFERENCES dbo.[ROLE](role_id)
);

--Tabla PERMISSION --
CREATE TABLE dbo.PERMISSION
(
    permission_id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(200) NOT NULL,
    module VARCHAR(200) NOT NULL,

    CONSTRAINT PK_PERMISSION
        PRIMARY KEY (permission_id)
);

--Tabla ROLE_PERMISSION --
CREATE TABLE dbo.ROLE_PERMISSION
(
    role_permission_id INT IDENTITY(1,1) NOT NULL,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,

    CONSTRAINT PK_ROLE_PERMISSION
        PRIMARY KEY (role_permission_id),

    CONSTRAINT UQ_ROLE_PERMISSION
        UNIQUE (role_id, permission_id),

    CONSTRAINT FK_ROLE_PERMISSION_ROLE
        FOREIGN KEY (role_id)
        REFERENCES dbo.[ROLE](role_id),

    CONSTRAINT FK_ROLE_PERMISSION_PERMISSION
        FOREIGN KEY (permission_id)
        REFERENCES dbo.PERMISSION(permission_id)
);
