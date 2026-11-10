-- Datos de prueba ficticios: usuarios @demo.femsa.test, participantes y unidades de negocio.
-- Viene de: hectorpablogzz/auditoria_bd@3124744 scripts/datos_prueba_usuarios_organizacion.sql
-- Solo para una base de desarrollo; ya está cargado en E12_FEMSA.

-- FE1S-34 · Datos de prueba: usuarios y organización (ficticios)

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Unidades de negocio nuevas

INSERT INTO dbo.BUSINESS_UNIT (unity, country, audit_id, code, direction, division, area, time_zone)
SELECT v.unity, v.country, NULL, v.code, v.direction, v.division, v.area, v.time_zone
FROM (VALUES
  (N'OXXO Gas',       N'México',    'UDN-0007', N'Retail & Spin', N'Combustibles', N'Estaciones de servicio',      'America/Monterrey'),
  (N'KOF Colombia',   N'Colombia',  'UDN-0008', N'Bebidas',       N'Operaciones',  N'Planta Tocancipá',            'America/Bogota'),
  (N'FEMSA Salud',    N'Chile',     'UDN-0009', N'Retail & Spin', N'Farmacias',    N'Operación de sucursales',     'America/Santiago'),
  (N'KOF Guatemala',  N'Guatemala', 'UDN-0010', N'Bebidas',       N'Distribución', N'CEDIS Ciudad de Guatemala',   'America/Guatemala')
) AS v (unity, country, code, direction, division, area, time_zone)
WHERE NOT EXISTS (SELECT 1 FROM dbo.BUSINESS_UNIT b WHERE b.code = v.code);


-- Usuarios nuevos

INSERT INTO dbo.[USER] (entra_id, email, full_name, is_active, role_id, direction, business_unit_id, time_zone)
SELECT NEWID(), v.email, v.full_name, 1,
       (SELECT r.role_id FROM dbo.[ROLE] r WHERE r.code = v.rol),
       v.direction,
       (SELECT b.business_unit_id FROM dbo.BUSINESS_UNIT b WHERE b.code = v.udn),
       v.time_zone
FROM (VALUES
  -- auditor (7)
  ('mariana.solis@demo.femsa.test',       N'Mariana Solís',       'auditor',   N'Bebidas',       NULL,        'America/Mexico_City'),
  ('tiago.rocha@demo.femsa.test',         N'Tiago Rocha',         'auditor',   N'Bebidas',       NULL,        'America/Mexico_City'),
  ('valeria.cardenas@demo.femsa.test',    N'Valeria Cárdenas',    'auditor',   N'Bebidas',       NULL,        'America/Mexico_City'),
  ('andres.quintero@demo.femsa.test',     N'Andrés Quintero',     'auditor',   N'Bebidas',       NULL,        'America/Mexico_City'),
  ('sofia.villalobos@demo.femsa.test',    N'Sofía Villalobos',    'auditor',   N'Retail & Spin', NULL,        'America/Monterrey'),
  ('diego.montemayor@demo.femsa.test',    N'Diego Montemayor',    'auditor',   N'Retail & Spin', NULL,        'America/Monterrey'),
  ('lucia.navarro@demo.femsa.test',       N'Lucía Navarro',       'auditor',   N'Retail & Spin', NULL,        'America/Monterrey'),
  -- lider (3)
  ('ricardo.aguilar@demo.femsa.test',     N'Ricardo Aguilar',     'lider',     N'Bebidas',       NULL,        'America/Mexico_City'),
  ('paula.mendes@demo.femsa.test',        N'Paula Mendes',        'lider',     N'Bebidas',       NULL,        'America/Mexico_City'),
  ('fernanda.ochoa@demo.femsa.test',      N'Fernanda Ochoa',      'lider',     N'Retail & Spin', NULL,        'America/Monterrey'),
  -- jefe (2)
  ('hugo.esquivel@demo.femsa.test',       N'Hugo Esquivel',       'jefe',      N'Bebidas',       NULL,        'America/Mexico_City'),
  ('claudia.benavides@demo.femsa.test',   N'Claudia Benavides',   'jefe',      N'Retail & Spin', NULL,        'America/Monterrey'),
  -- gerente (2)
  ('oscar.pineda@demo.femsa.test',        N'Óscar Pineda',        'gerente',   N'Bebidas',       NULL,        'America/Mexico_City'),
  ('monica.zambrano@demo.femsa.test',     N'Mónica Zambrano',     'gerente',   N'Retail & Spin', NULL,        'America/Monterrey'),
  -- grc (5)
  ('alejandro.ruiz@demo.femsa.test',      N'Alejandro Ruiz',      'grc',       N'Bebidas',       'UDN-0001',  'America/Mexico_City'),
  ('gabriela.leal@demo.femsa.test',       N'Gabriela Leal',       'grc',       N'Retail & Spin', 'UDN-0002',  'America/Monterrey'),
  ('ivan.castro@demo.femsa.test',         N'Iván Castro',         'grc',       N'Retail & Spin', 'UDN-0003',  'America/Monterrey'),
  ('renata.alves@demo.femsa.test',        N'Renata Alves',        'grc',       N'Bebidas',       'UDN-0005',  'America/Sao_Paulo'),
  ('lukas.meier@demo.femsa.test',         N'Lukas Meier',         'grc',       N'Retail & Spin', 'UDN-0006',  'Europe/Zurich'),
  -- auditado (10)
  ('ernesto.cavazos@demo.femsa.test',     N'Ernesto Cavazos',     'auditado',  N'Bebidas',       'UDN-0001',  'America/Mexico_City'),
  ('karla.trevino@demo.femsa.test',       N'Karla Treviño',       'auditado',  N'Retail & Spin', 'UDN-0002',  'America/Monterrey'),
  ('daniela.rivas@demo.femsa.test',       N'Daniela Rivas',       'auditado',  N'Retail & Spin', 'UDN-0003',  'America/Monterrey'),
  ('arturo.lozano@demo.femsa.test',       N'Arturo Lozano',       'auditado',  N'Retail & Spin', 'UDN-0004',  'America/Monterrey'),
  ('beatriz.souza@demo.femsa.test',       N'Beatriz Souza',       'auditado',  N'Bebidas',       'UDN-0005',  'America/Sao_Paulo'),
  ('anna.keller@demo.femsa.test',         N'Anna Keller',         'auditado',  N'Retail & Spin', 'UDN-0006',  'Europe/Zurich'),
  ('raul.elizondo@demo.femsa.test',       N'Raúl Elizondo',       'auditado',  N'Retail & Spin', 'UDN-0007',  'America/Monterrey'),
  ('camila.restrepo@demo.femsa.test',     N'Camila Restrepo',     'auditado',  N'Bebidas',       'UDN-0008',  'America/Bogota'),
  ('matias.fuentes@demo.femsa.test',      N'Matías Fuentes',      'auditado',  N'Retail & Spin', 'UDN-0009',  'America/Santiago'),
  ('josefina.morales@demo.femsa.test',    N'Josefina Morales',    'auditado',  N'Bebidas',       'UDN-0010',  'America/Guatemala'),
  -- admin (1): sin dirección ni unidad
  ('patricia.ibanez@demo.femsa.test',     N'Patricia Ibáñez',     'admin',     NULL,             NULL,        'America/Monterrey')
) AS v (email, full_name, rol, direction, udn, time_zone)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[USER] u WHERE u.email = v.email);

-- Participantes

INSERT INTO dbo.AUDIT_PARTICIPANT (audit_id, user_id, role_in_audit)
SELECT a.audit_id, u.user_id, v.papel
FROM (VALUES
  ('AUD-000001', 'mariana.solis@demo.femsa.test',     'auditor'),
  ('AUD-000006', 'mariana.solis@demo.femsa.test',     'auditor'),
  ('AUD-000001', 'tiago.rocha@demo.femsa.test',       'auditor'),
  ('AUD-000006', 'tiago.rocha@demo.femsa.test',       'auditor'),
  ('AUD-000001', 'valeria.cardenas@demo.femsa.test',  'auditor'),
  ('AUD-000006', 'valeria.cardenas@demo.femsa.test',  'auditor'),
  ('AUD-000001', 'andres.quintero@demo.femsa.test',   'auditor'),
  ('AUD-000006', 'andres.quintero@demo.femsa.test',   'auditor'),
  ('AUD-000002', 'sofia.villalobos@demo.femsa.test',  'auditor'),
  ('AUD-000008', 'sofia.villalobos@demo.femsa.test',  'auditor'),
  ('AUD-000007', 'diego.montemayor@demo.femsa.test',  'auditor'),
  ('AUD-000011', 'diego.montemayor@demo.femsa.test',  'auditor'),
  ('AUD-000005', 'lucia.navarro@demo.femsa.test',     'auditor'),
  ('AUD-000003', 'lucia.navarro@demo.femsa.test',     'auditor'),
  ('AUD-000001', 'ernesto.cavazos@demo.femsa.test',   'responsable'),
  ('AUD-000008', 'karla.trevino@demo.femsa.test',     'responsable'),
  ('AUD-000011', 'karla.trevino@demo.femsa.test',     'enlace'),
  ('AUD-000007', 'daniela.rivas@demo.femsa.test',     'responsable'),
  ('AUD-000009', 'arturo.lozano@demo.femsa.test',     'responsable'),
  ('AUD-000006', 'beatriz.souza@demo.femsa.test',     'responsable'),
  ('AUD-000010', 'anna.keller@demo.femsa.test',       'responsable')
) AS v (auditoria, email, papel)
JOIN dbo.AUDIT a ON a.tracking_id = v.auditoria
JOIN dbo.[USER] u ON u.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM dbo.AUDIT_PARTICIPANT p WHERE p.audit_id = a.audit_id AND p.user_id = u.user_id);

COMMIT;

-- Tests

-- Test usuarios por rol (45 total)
SELECT r.code, COUNT(*) AS usuarios
FROM dbo.[USER] u JOIN dbo.[ROLE] r ON r.role_id = u.role_id
WHERE u.email LIKE '%@demo.femsa.test'
GROUP BY r.code ORDER BY r.code;

-- Unidades de negocio
SELECT code, unity FROM dbo.BUSINESS_UNIT WHERE code IS NOT NULL ORDER BY code;

-- grc y auditado deben tener unidad, el resto de los roles no
SELECT r.code AS rol, COUNT(*) AS total, SUM(CASE WHEN u.business_unit_id IS NULL THEN 1 ELSE 0 END) AS sin_unidad
FROM dbo.[USER] u JOIN dbo.[ROLE] r ON r.role_id = u.role_id
WHERE u.email LIKE '%@demo.femsa.test'
GROUP BY r.code ORDER BY r.code;

-- Participantes por auditoría
SELECT a.tracking_id, COUNT(*) AS participantes
FROM dbo.AUDIT_PARTICIPANT p JOIN dbo.AUDIT a ON a.audit_id = p.audit_id
GROUP BY a.tracking_id ORDER BY a.tracking_id;

-- Correos duplicados (0)
SELECT email, COUNT(*) AS veces FROM dbo.[USER] GROUP BY email HAVING COUNT(*) > 1;