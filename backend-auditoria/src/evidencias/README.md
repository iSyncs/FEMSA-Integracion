# HU_03 - Configuracion pendiente de evidencias

El codigo de carga, validacion, consulta, reemplazo y borrado logico ya esta implementado. Antes de usarlo en un ambiente real deben completarse los puntos de esta lista.

## 1. Variables del backend

Copiar las variables documentadas en `backend/.env.example` al almacen de secretos del ambiente. No guardar secretos en Git ni enviarlos al frontend.

```env
AZURE_STORAGE_ACCOUNT_NAME=<nombre-de-la-cuenta>
AZURE_STORAGE_CONTAINER=evidencias
EVIDENCE_TOKEN_SECRET=<secreto-aleatorio-de-32-bytes-o-mas>
EVIDENCE_MAX_BYTES=26214400
EVIDENCE_ZIP_MAX_FILES=50
EVIDENCE_ZIP_MAX_UNCOMPRESSED_BYTES=104857600
EVIDENCE_ZIP_MAX_RATIO=100
AZURE_DEFENDER_REQUIRED=true
```

En produccion se debe usar identidad administrada. `AZURE_STORAGE_CONNECTION_STRING` queda reservado para Azurite o desarrollo local y nunca debe exponerse en el navegador.

## 2. Cuenta de Azure Storage

- Crear o seleccionar una cuenta StorageV2.
- Crear el contenedor privado indicado en `AZURE_STORAGE_CONTAINER`.
- Deshabilitar el acceso publico a blobs y exigir transferencia segura HTTPS.
- Asignar a la identidad administrada del backend el rol **Storage Blob Data Contributor**.
- Permitir que esa identidad solicite una User Delegation Key para generar SAS.
- Restringir red, firewall y Private Endpoint segun el ambiente de despliegue.
- Configurar CORS solamente para los origenes reales del frontend y los metodos `PUT`, `GET`, `HEAD` y `OPTIONS`.
- Confirmar que los SAS de escritura expiren a los 10 minutos y los de lectura a los 5 minutos.

## 3. Cifrado y administracion de claves

Azure Storage cifra los blobs en reposo con cifrado del servicio. Antes de produccion se debe decidir y documentar si se usara:

- clave administrada por Microsoft, o
- Customer-Managed Key almacenada en Azure Key Vault.

Si se usa una clave propia, configurar rotacion, permisos minimos de Key Vault, alertas y un procedimiento de recuperacion. Las claves nunca deben llegar al frontend ni almacenarse junto con los archivos.

## 4. Antivirus

- Habilitar Microsoft Defender for Storage y **malware scanning on upload**.
- Habilitar la publicacion del resultado mediante Blob Index Tags.
- Verificar que la identidad del backend pueda leer los tags.
- Mantener `AZURE_DEFENDER_REQUIRED=true` en produccion.
- Probar un archivo limpio y el archivo de prueba EICAR en un ambiente aislado.
- Configurar alertas y el procedimiento para eliminar o poner en cuarentena archivos maliciosos.

La confirmacion devuelve un estado temporal mientras Defender no haya publicado `No threats found`; el frontend debe reintentar sin volver a subir el archivo.

## 5. Historial y recuperacion

- Habilitar Blob soft delete con retencion de **180 dias**.
- Habilitar versionado de blobs.
- Validar la restauracion de un blob eliminado y de una version reemplazada.
- Crear una politica de ciclo de vida para eliminar definitivamente contenido una vez cumplido el periodo autorizado.
- Confirmar con Legal/Seguridad si la bitacora debe conservarse por mas de 180 dias.

El endpoint `DELETE` realiza un borrado logico en SQL; no borra inmediatamente el blob. Un reemplazo crea una evidencia nueva y marca la anterior como eliminada.

## 6. MIME y formatos permitidos

| Extension | MIME canonico | Validacion adicional |
|---|---|---|
| `.pdf` | `application/pdf` | Debe iniciar con `%PDF-` |
| `.png` | `image/png` | Debe contener la firma PNG de 8 bytes |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ZIP OOXML con `[Content_Types].xml` y carpeta `xl/` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ZIP OOXML con `[Content_Types].xml` y carpeta `word/` |
| `.zip` | `application/zip` | Contenedor ZIP valido y analisis de todas sus entradas |

El cliente debe enviar el MIME canonico. Se tolera `application/octet-stream` porque algunos navegadores no identifican el formato, pero esto **no omite la validacion**: el backend vuelve a determinar el MIME esperado a partir de la extension y comprueba la firma o estructura real antes de registrar la evidencia.

No se admiten HTML, JavaScript, ejecutables, macros de Office (`.docm`, `.xlsm`), archivos ZIP anidados ni archivos protegidos con contrasena. Las respuestas usan `Content-Disposition`; solamente PDF y PNG pueden abrirse `inline`, mientras los demas tipos se descargan como adjuntos.

## 7. Base de datos y operacion

- Aplicar y verificar el esquema que contiene evidencia padre/hija, hash SHA-256 y borrado logico.
- Usar una identidad SQL de privilegios minimos; no usar `dbo` como usuario de ejecucion en produccion.
- Confirmar que todas las consultas sigan parametrizadas.
- Definir respaldo, restauracion y monitoreo de fallos de registro.
- Verificar que `CARGAR`, `REEMPLAZAR` y `ELIMINAR_LOGICO` queden en la bitacora con usuario y fecha UTC.

## 8. Pruebas obligatorias antes de liberar

- Cargar y consultar un archivo valido de cada MIME permitido.
- Intentar subir un ejecutable renombrado como PDF, PNG, DOCX y XLSX.
- Probar exceso de tamano, MIME incorrecto y nombre con ruta insegura.
- Probar ZIP con demasiados archivos, ZIP bomb, ZIP cifrado, ZIP anidado y rutas `../`.
- Confirmar folio padre `SOPORTE-######`, folios hijo `SOPORTE-######-NNN` y hashes SHA-256.
- Confirmar que un usuario sin acceso a la auditoria no pueda crear ni obtener un SAS.
- Confirmar expiracion, permisos y alcance a un solo blob de cada SAS.
- Probar previsualizacion de PDF/PNG y descarga de DOCX/XLSX/ZIP.
- Probar reemplazo, borrado logico y recuperacion dentro de los 180 dias.
- Ejecutar pruebas de penetracion para inyeccion SQL, nombres maliciosos, manipulacion del token y reutilizacion de SAS.

## Estado actual

La compilacion y las pruebas automatizadas funcionan con un adaptador simulado de Blob Storage. La integracion real no se considera validada hasta completar la configuracion anterior y ejecutar las pruebas contra una cuenta Azure de desarrollo.
