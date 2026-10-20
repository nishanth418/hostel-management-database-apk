const fs = require('fs');
const path = require('path');
require('dotenv').config();

const REQUIRED_TABLES = [
  'WARDEN',
  'WARDEN_PHONE',
  'HOSTEL',
  'ROOM_TYPE',
  'ROOM',
  'STUDENT',
  'STUDENT_PHONE',
  'MESS',
  'MESS_CONTACT',
  'MEAL',
  'STAFF',
  'STAFF_PHONE',
  'SUPPLIER',
  'SUPPLIER_PHONE',
  'INVENTORY_ITEM',
  'PROCURES',
  'PAYMENT',
  'PAYMENT_DETAIL'
];

const SCHEMA_MYSQL_PATH = path.resolve(__dirname, 'database/schema_mysql.sql');
const SCHEMA_PG_PATH = path.resolve(__dirname, 'database/schema_postgres.sql');
const SEED_PATH = path.resolve(__dirname, 'database/seed.sql');

function getEngineType() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgres';
  }
  if (url.startsWith('mysql://') || (process.env.DB_HOST && process.env.DB_HOST.trim())) {
    return 'mysql';
  }
  return 'sqlite';
}

// ----------------------------------------------------
// PostgreSQL Pool (Render Postgres / Supabase / Neon)
// ----------------------------------------------------
let pgPool = null;
function getPgPool() {
  if (!pgPool) {
    const { Pool } = require('pg');
    const connectionString = process.env.DATABASE_URL;
    const isInternalRender = connectionString.includes('@dpg-') && !connectionString.includes('.render.com:');
    const useSsl = process.env.DB_SSL === 'true' || (!isInternalRender && process.env.DB_SSL !== 'false');

    pgPool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pgPool;
}

// ----------------------------------------------------
// MySQL Pool (Cloud MySQL)
// ----------------------------------------------------
let mysqlPool = null;
function getMysqlPool() {
  if (!mysqlPool) {
    const mysql = require('mysql2/promise');
    let config = {};
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')) {
      try {
        const parsed = new URL(process.env.DATABASE_URL);
        config = {
          host: parsed.hostname,
          port: parsed.port ? parseInt(parsed.port, 10) : 3306,
          user: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
          database: parsed.pathname.replace(/^\//, '') || 'defaultdb',
          ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
          waitForConnections: true,
          connectionLimit: 10,
          multipleStatements: true
        };
      } catch (err) {
        console.warn('Failed parsing MySQL DATABASE_URL:', err.message);
      }
    } else {
      config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'avnadmin',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'defaultdb',
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
        multipleStatements: true
      };
    }
    mysqlPool = mysql.createPool(config);
  }
  return mysqlPool;
}

// ----------------------------------------------------
// SQLite Fallback
// ----------------------------------------------------
let sqliteDb = null;
function getSqlite() {
  if (!sqliteDb) {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      throw new Error('No database connection specified. Please provide DATABASE_URL in environment.');
    }
    const dbDir = path.resolve(__dirname, 'database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    sqliteDb = new Database(path.join(dbDir, 'hostel.db'));
    sqliteDb.pragma('foreign_keys = ON');
  }
  return sqliteDb;
}

/**
 * Adapt SQL statement for dialect
 */
function adaptSql(sql, engine) {
  if (typeof sql !== 'string') return sql;
  let adapted = sql;

  if (engine === 'postgres') {
    // Convert GROUP_CONCAT(expr, ', ') or GROUP_CONCAT(expr SEPARATOR ', ') to STRING_AGG(expr::text, ', ')
    adapted = adapted.replace(/GROUP_CONCAT\s*\(\s*([^,\)]+?)\s*(?:SEPARATOR|,)\s*(['"][^'"]*['"])\s*\)/gi, "STRING_AGG($1::text, $2)");
    adapted = adapted.replace(/GROUP_CONCAT\s*\(\s*([^,\)]+?)\s*\)/gi, "STRING_AGG($1::text, ', ')");

    // Replace backticks with double quotes for PostgreSQL
    adapted = adapted.replace(/`([^`]+)`/g, '"$1"');

    // Convert parameter '?' placeholders to '$1', '$2', ...
    let paramIndex = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let result = '';
    for (let i = 0; i < adapted.length; i++) {
      const c = adapted[i];
      if (c === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        result += c;
      } else if (c === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        result += c;
      } else if (c === '?' && !inSingleQuote && !inDoubleQuote) {
        result += '$' + (paramIndex++);
      } else {
        result += c;
      }
    }
    adapted = result;
  } else if (engine === 'mysql') {
    adapted = adapted.replace(/GROUP_CONCAT\s*\(\s*([^,\)]+?)\s*\)/gi, 'GROUP_CONCAT($1 SEPARATOR $2)');
  }
  return adapted;
}

/**
 * Universal async query (SELECT / read)
 */
async function query(sql, params = []) {
  const engine = getEngineType();
  const adapted = adaptSql(sql, engine);

  if (engine === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(adapted, params);
    return res.rows;
  } else if (engine === 'mysql') {
    const pool = getMysqlPool();
    const [rows] = await pool.query(adapted, params);
    return rows;
  } else {
    const s = getSqlite().prepare(adapted);
    return s.all(...params);
  }
}

/**
 * Universal async execute (INSERT / UPDATE / DELETE / DDL)
 */
async function execute(sql, params = []) {
  const engine = getEngineType();
  const adapted = adaptSql(sql, engine);

  if (engine === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(adapted, params);
    return {
      affectedRows: res.rowCount,
      rowCount: res.rowCount,
      rows: res.rows
    };
  } else if (engine === 'mysql') {
    const pool = getMysqlPool();
    const [result] = await pool.execute(adapted, params);
    return result;
  } else {
    const s = getSqlite().prepare(adapted);
    const info = s.run(...params);
    return {
      affectedRows: info.changes,
      insertId: info.lastInsertRowid,
      changes: info.changes
    };
  }
}

/**
 * Retrieve list of application table names
 */
async function getApplicationTables() {
  const engine = getEngineType();

  if (engine === 'postgres') {
    const pool = getPgPool();
    const res = await pool.query(`
      SELECT table_name as name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);
    const foundNames = res.rows.map(r => r.name.toLowerCase());
    const canonical = REQUIRED_TABLES.filter(req => foundNames.includes(req.toLowerCase()));
    const others = res.rows.map(r => r.name).filter(n => !REQUIRED_TABLES.some(req => req.toLowerCase() === n.toLowerCase()));
    return [...canonical, ...others];
  } else if (engine === 'mysql') {
    const pool = getMysqlPool();
    const [rows] = await pool.query(`
      SELECT TABLE_NAME as name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND table_type = 'BASE TABLE'
      ORDER BY TABLE_NAME ASC;
    `);
    return rows.map(r => r.name);
  } else {
    const rows = getSqlite().prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC;
    `).all();
    return rows.map(r => r.name);
  }
}

/**
 * Split multi-statement SQL script
 */
function splitSqlStatements(sql) {
  const statements = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let current = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && sql[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
        current += char;
      }
    } else if (char === '"' && !inSingleQuote) {
      if (inDoubleQuote && sql[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inDoubleQuote = !inDoubleQuote;
        current += char;
      }
    } else if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements;
}

/**
 * Initialize Database schema and seed data
 */
async function initDatabase(force = false) {
  const engine = getEngineType();
  const existingTables = await getApplicationTables();

  if (existingTables.length >= 18 && !force) {
    console.log(`Database already initialized with ${existingTables.length} tables.`);
    return { initialized: false, tables: existingTables };
  }

  console.log(`Initializing ${engine.toUpperCase()} database schema...`);

  if (engine === 'postgres') {
    const pool = getPgPool();
    const schemaFile = fs.existsSync(SCHEMA_PG_PATH) ? SCHEMA_PG_PATH : SCHEMA_MYSQL_PATH;
    const schemaSql = fs.readFileSync(schemaFile, 'utf-8');
    const statements = splitSqlStatements(schemaSql);

    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await pool.query(stmt);
        } catch (err) {
          console.warn('Schema statement warning/skip:', err.message);
        }
      }
    }

    // Seed data if student table is empty
    if (fs.existsSync(SEED_PATH)) {
      try {
        const studentCheck = await pool.query('SELECT COUNT(*) as count FROM "STUDENT"').catch(() => null) 
          || await pool.query('SELECT COUNT(*) as count FROM student').catch(() => null);
        const count = parseInt(studentCheck?.rows[0]?.count || 0, 10);
        if (count === 0) {
          console.log('Seeding initial data into PostgreSQL...');
          const seedSql = fs.readFileSync(SEED_PATH, 'utf-8');
          const seedStmts = splitSqlStatements(seedSql);
          for (const s of seedStmts) {
            if (s.trim()) {
              try {
                await pool.query(s);
              } catch (err) {
                console.warn('Seed statement warning:', err.message);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Seeding check error:', err.message);
      }
    }
  } else if (engine === 'mysql') {
    const pool = getMysqlPool();
    if (fs.existsSync(SCHEMA_MYSQL_PATH)) {
      const schemaSql = fs.readFileSync(SCHEMA_MYSQL_PATH, 'utf-8');
      await pool.query(schemaSql);
    }
    if (fs.existsSync(SEED_PATH)) {
      try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM STUDENT');
        if (rows[0].count === 0) {
          console.log('Seeding initial data into MySQL...');
          const seedSql = fs.readFileSync(SEED_PATH, 'utf-8');
          const seedStmts = splitSqlStatements(seedSql);
          for (const s of seedStmts) {
            if (s.trim()) {
              try {
                await pool.query(s);
              } catch (err) {
                console.warn('Seed statement warning:', err.message);
              }
            }
          }
        }
      } catch (err) {
        console.warn('MySQL seed check error:', err.message);
      }
    }
  }

  const finalTables = await getApplicationTables();
  console.log(`Database initialization complete. Total tables: ${finalTables.length}`);
  return { initialized: true, tables: finalTables };
}

/**
 * Verify presence of all 18 tables
 */
async function verifyDatabase() {
  try {
    const engine = getEngineType();
    const tables = await getApplicationTables();
    console.log(`\n--- VERIFYING ${engine.toUpperCase()} APPLICATION TABLES (Total: ${tables.length}) ---`);
    tables.forEach((t, i) => console.log(`${i + 1}. ${t}`));

    const lowerTables = tables.map(t => t.toLowerCase());
    const missing = REQUIRED_TABLES.filter(t => !lowerTables.includes(t.toLowerCase()));

    if (missing.length === 0 && tables.length >= 18) {
      console.log(`\n SUCCESS: All 18 expected application tables exist in ${engine.toUpperCase()}.`);
      return { success: true, count: tables.length, tables };
    } else {
      console.log(`\n NOTE: Tables found: ${tables.length}/18. Missing:`, missing);
      if (tables.length === 0) {
        console.log('Triggering auto-initialization of schema and seed data...');
        await initDatabase(true);
        const recheck = await getApplicationTables();
        return { success: recheck.length >= 18, count: recheck.length, tables: recheck };
      }
      return { success: missing.length === 0, count: tables.length, tables, missing };
    }
  } catch (err) {
    console.error('Error verifying database:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Comprehensive health status for /api/health
 */
async function getHealthStatus() {
  const engine = getEngineType();
  try {
    let details = {};
    if (engine === 'postgres') {
      const pool = getPgPool();
      const res = await pool.query('SELECT current_database() as db, version() as version');
      details = res.rows[0];
    } else if (engine === 'mysql') {
      const pool = getMysqlPool();
      const [rows] = await pool.query('SELECT DATABASE() as db, VERSION() as version');
      details = rows[0];
    }

    const tables = await getApplicationTables();
    return {
      status: 'healthy',
      database: 'connected',
      engine: engine === 'postgres' ? 'PostgreSQL (Cloud / Render)' : (engine === 'mysql' ? 'MySQL (Cloud)' : 'SQLite 3'),
      totalApplicationTables: tables.length,
      tables,
      foreignKeysEnforced: true,
      serviceDetails: details,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      engine: engine.toUpperCase(),
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  query,
  execute,
  getApplicationTables,
  verifyDatabase,
  getHealthStatus,
  initDatabase,
  REQUIRED_TABLES,
  getEngineType,
  adaptSql
};
