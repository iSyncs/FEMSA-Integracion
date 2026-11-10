const sql = require('mssql');
require('dotenv').config({ path: __dirname + '/.env' });

const config = {
  server: process.env.DB_SERVER || process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 30000,
  requestTimeout: 30000,
  options: {
    encrypt: true, // Requerido para Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true,
  },
};

console.log('Test a Azure');
console.log(`Servidor:  ${config.server}:${config.port}`);
console.log(`Base de datos: ${config.database}`);
console.log(`Usuario:   ${config.user}`);
console.log('Conectando...');

async function testConnection() {
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(config);
    const duration = Date.now() - startTime;
    console.log(`\n Conexión exitosa a Azure SQL en ${duration} ms!`);

    const result = await pool.request().query(`
      SELECT 
        @@VERSION AS version, 
        DB_NAME() AS current_db,
        CURRENT_USER AS current_user_name,
        SYSUTCDATETIME() AS server_utc_time
    `);

    console.log('\nInformación del Servidor:');
    console.log(`- Base de datos activa: ${result.recordset[0].current_db}`);
    console.log(`- Usuario autenticado: ${result.recordset[0].current_user_name}`);
    console.log(`- Fecha/Hora Servidor (UTC): ${result.recordset[0].server_utc_time}`);
    console.log(`- Versión SQL:\n  ${result.recordset[0].version.split('\n')[0]}`);

    // Comprobar tablas existentes
    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    console.log(`\nTablas encontradas en '${config.database}': ${tables.recordset.length}`);
    if (tables.recordset.length > 0) {
      tables.recordset.forEach(t => console.log(`  - ${t.TABLE_SCHEMA}.${t.TABLE_NAME}`));
    } else {
      console.log('  (La base de datos está completamente vacía, lista para el esquema)');
    }

  } catch (error) {
    console.error('\n Error de conexión a Azure SQL:');
    console.error(`Código: ${error.code || 'N/A'}`);
    console.error(`Mensaje: ${error.message}`);

    if (error.message && error.message.includes('Firewall') || error.code === 'ELOGIN') {
      console.log('\n SUGERENCIA: Si el error menciona "Firewall", debes autorizar tu IP pública actual en el portal de Azure SQL (Networking / Firewalls).');
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

testConnection();
