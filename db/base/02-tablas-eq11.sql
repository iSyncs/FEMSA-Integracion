-- 02-tablas-eq11.sql · tablas del Equipo 11 (App Builder y Workflow Modeler)
-- Viene de: hectorpablogzz/auditoria_bd@3124744 scripts/tablas_eq11.sql
-- Base inicial: ya existe en E12_FEMSA. Solo para crear una base nueva desde cero. NO se puede correr dos veces.

--Tabla APPLICATION--
CREATE TABLE dbo.APPLICATION
(
    application_id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(200) NOT NULL,
    status VARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    published_at DATETIME2 NULL,
    user_id INT NOT NULL,

    CONSTRAINT PK_APPLICATION
        PRIMARY KEY (application_id),

    CONSTRAINT FK_APPLICATION_USER
        FOREIGN KEY (user_id)
        REFERENCES dbo.[USER](user_id)
);

--Tabla WORKFLOW--
CREATE TABLE dbo.WORKFLOW
(
    workflow_id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(200) NOT NULL,
    status VARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    application_id INT NOT NULL,

    CONSTRAINT PK_WORKFLOW
        PRIMARY KEY (workflow_id),

    CONSTRAINT FK_WORKFLOW_APPLICATION
        FOREIGN KEY (application_id)
        REFERENCES dbo.APPLICATION(application_id)
);

--Tabla ACTIVITY--
CREATE TABLE dbo.ACTIVITY
(
    activity_id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(200) NOT NULL,
    activity_type VARCHAR(200) NOT NULL,
    position_x INT NOT NULL,
    position_y INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    workflow_id INT NOT NULL,

    CONSTRAINT PK_ACTIVITY
        PRIMARY KEY (activity_id),

    CONSTRAINT FK_ACTIVITY_WORKFLOW
        FOREIGN KEY (workflow_id)
        REFERENCES dbo.WORKFLOW(workflow_id)
);

--Tabla ACTIVITY_RELATIONSHIP--
CREATE TABLE dbo.ACTIVITY_RELATIONSHIP
(
    relationship_id INT IDENTITY(1,1) NOT NULL,
    relationship_type VARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    activity_id INT NOT NULL,

    CONSTRAINT PK_ACTIVITY_RELATIONSHIP
        PRIMARY KEY (relationship_id),

    CONSTRAINT FK_ACTIVITY_RELATIONSHIP_ACTIVITY
        FOREIGN KEY (activity_id)
        REFERENCES dbo.ACTIVITY(activity_id)
);

--Tabla APPLICATION_VERSION--
CREATE TABLE dbo.APPLICATION_VERSION
(
    version_id INT IDENTITY(1,1) NOT NULL,
    version_number INT NOT NULL,
    status VARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    published_at DATETIME2 NULL,
    application_id INT NOT NULL,

    CONSTRAINT PK_APPLICATION_VERSION
        PRIMARY KEY (version_id),

    CONSTRAINT FK_APPLICATION_VERSION_APPLICATION
        FOREIGN KEY (application_id)
        REFERENCES dbo.APPLICATION(application_id)
);

--AI_RECOMMENDATION--
CREATE TABLE dbo.AI_RECOMMENDATION
(
    recommendation_id INT IDENTITY(1,1) NOT NULL,
    recommendation_type VARCHAR(200) NOT NULL,
    status VARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    application_id INT NOT NULL,

    CONSTRAINT PK_AI_RECOMMENDATION
        PRIMARY KEY (recommendation_id),

    CONSTRAINT FK_AI_RECOMMENDATION_APPLICATION
        FOREIGN KEY (application_id)
        REFERENCES dbo.APPLICATION(application_id)
);

--Tabla NODE--
CREATE TABLE dbo.NODE
(
    node_id INT IDENTITY(1,1) NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(200) NOT NULL,
    position_x INT NOT NULL,
    position_y INT NOT NULL,
    workflow_id INT NOT NULL,

    CONSTRAINT PK_NODE
        PRIMARY KEY (node_id),

    CONSTRAINT FK_NODE_WORKFLOW
        FOREIGN KEY (workflow_id)
        REFERENCES dbo.WORKFLOW(workflow_id)
);

--Tabla TRANSITION--
CREATE TABLE dbo.TRANSITION
(
    transition_id INT IDENTITY(1,1) NOT NULL,
    condition VARCHAR(200) NOT NULL,
    label VARCHAR(200) NOT NULL,
    workflow_id INT NOT NULL,

    CONSTRAINT PK_TRANSITION
        PRIMARY KEY (transition_id),

    CONSTRAINT FK_TRANSITION_WORKFLOW
        FOREIGN KEY (workflow_id)
        REFERENCES dbo.WORKFLOW(workflow_id)
);
