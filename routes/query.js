const express = require('express');
const router = express.Router();
const { query, execute, getApplicationTables, getEngineType } = require('../database');

// Helper to split SQL script into individual statements safely honoring quotes
function splitStatements(sql) {
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

function isReaderQuery(sql) {
  return /^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.test(sql);
}

// POST /api/query - Execute ANY SQL operation (DQL, DML, DDL, Joins, Aggregates, Multi-statement scripts)
router.post('/', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Query cannot be empty.',
        message: 'Query cannot be empty.'
      });
    }

    const statements = splitStatements(sql.trim());
    if (statements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid SQL statements found.',
        message: 'No valid SQL statements found.'
      });
    }

    const startTime = process.hrtime();

    // Case 1: Single statement
    if (statements.length === 1) {
      const cleanSql = statements[0];
      const firstWordMatch = cleanSql.match(/^\s*([A-Za-z]+)/);
      const commandType = firstWordMatch ? firstWordMatch[1].toUpperCase() : 'SQL';

      if (isReaderQuery(cleanSql)) {
        const rows = await query(cleanSql);
        const diff = process.hrtime(startTime);
        const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

        let columns = [];
        if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
          columns = Object.keys(rows[0]);
        }

        return res.json({
          success: true,
          type: commandType === 'WITH' ? 'WITH' : 'SELECT',
          query: cleanSql,
          count: Array.isArray(rows) ? rows.length : 0,
          columns,
          rows: Array.isArray(rows) ? rows : [],
          data: Array.isArray(rows) ? rows : [],
          executionTimeMs
        });
      }

      const result = await execute(cleanSql);
      const diff = process.hrtime(startTime);
      const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

      const changes = result.affectedRows !== undefined ? result.affectedRows : (result.changes || 0);
      const isDdl = ['CREATE', 'ALTER', 'DROP'].includes(commandType);

      return res.json({
        success: true,
        type: commandType,
        query: cleanSql,
        changes,
        lastInsertRowid: result.insertId || result.lastInsertRowid,
        message: isDdl
          ? `${commandType} command executed successfully`
          : `Command executed successfully\nAffected rows: ${changes}`,
        executionTimeMs
      });
    }

    // Case 2: Multi-statement batch execution
    let lastResult = null;
    let totalChanges = 0;
    let finalQueryRows = null;
    let finalColumns = [];

    for (let i = 0; i < statements.length; i++) {
      const s = statements[i];
      const isLast = i === statements.length - 1;

      if (isReaderQuery(s)) {
        if (isLast) {
          finalQueryRows = await query(s);
          if (Array.isArray(finalQueryRows) && finalQueryRows.length > 0 && typeof finalQueryRows[0] === 'object') {
            finalColumns = Object.keys(finalQueryRows[0]);
          }
        } else {
          await query(s);
        }
      } else {
        const info = await execute(s);
        const ch = info.affectedRows !== undefined ? info.affectedRows : (info.changes || 0);
        totalChanges += ch;
        lastResult = info;
      }
    }

    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

    if (finalQueryRows !== null) {
      return res.json({
        success: true,
        type: 'BATCH_QUERY',
        count: finalQueryRows.length,
        columns: finalColumns,
        rows: finalQueryRows,
        data: finalQueryRows,
        statementsCount: statements.length,
        changes: totalChanges,
        message: `Executed ${statements.length} statements successfully. Final query returned ${finalQueryRows.length} row(s).`,
        executionTimeMs
      });
    }

    return res.json({
      success: true,
      type: 'BATCH_SCRIPT',
      statementsCount: statements.length,
      changes: totalChanges,
      lastInsertRowid: lastResult ? (lastResult.insertId || lastResult.lastInsertRowid) : undefined,
      message: `Executed ${statements.length} SQL statements successfully.\nTotal affected rows: ${totalChanges}`,
      executionTimeMs
    });
  } catch (error) {
    console.error('Error executing custom SQL query:', error);
    return res.status(400).json({
      success: false,
      error: error.message,
      message: error.message
    });
  }
});

// GET /api/query/schema - Schema reference for SQL Studio Table Explorer
router.get('/schema', async (req, res) => {
  try {
    const engine = getEngineType();
    const schemaMap = {};

    if (engine === 'postgres') {
      const rows = await query(`
        SELECT 
          c.table_name as tablename,
          c.column_name as name,
          c.data_type as type,
          c.udt_name as fulltype,
          c.is_nullable as isnullable,
          c.column_default as dflt_value,
          c.ordinal_position as ordinalposition,
          (SELECT 'PRI' FROM information_schema.table_constraints tc 
           JOIN information_schema.key_column_usage kcu 
             ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY' 
             AND tc.table_schema = 'public' 
             AND tc.table_name = c.table_name 
             AND kcu.column_name = c.column_name
           LIMIT 1) as columnkey
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position ASC;
      `);

      for (const row of rows) {
        const tName = row.tablename.toUpperCase();
        if (!schemaMap[tName]) {
          schemaMap[tName] = [];
        }
        schemaMap[tName].push({
          cid: row.ordinalposition,
          name: row.name,
          type: (row.fulltype || row.type || 'VARCHAR').toUpperCase(),
          notnull: row.isnullable === 'NO',
          dflt_value: row.dflt_value,
          pk: row.columnkey === 'PRI'
        });
      }
    } else if (engine === 'mysql') {
      const rows = await query(`
        SELECT 
          TABLE_NAME as tableName,
          COLUMN_NAME as name,
          DATA_TYPE as type,
          COLUMN_TYPE as fullType,
          IS_NULLABLE as isNullable,
          COLUMN_DEFAULT as dflt_value,
          COLUMN_KEY as columnKey,
          ORDINAL_POSITION as ordinalPosition
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION ASC;
      `);

      for (const row of rows) {
        if (!schemaMap[row.tableName]) {
          schemaMap[row.tableName] = [];
        }
        schemaMap[row.tableName].push({
          cid: row.ordinalPosition,
          name: row.name,
          type: (row.fullType || row.type || 'VARCHAR').toUpperCase(),
          notnull: row.isNullable === 'NO',
          dflt_value: row.dflt_value,
          pk: row.columnKey === 'PRI'
        });
      }
    } else {
      const tables = await getApplicationTables();
      for (const table of tables) {
        const cols = await query(`PRAGMA table_info("${table}")`);
        schemaMap[table] = cols.map(c => ({
          cid: c.cid,
          name: c.name,
          type: c.type,
          notnull: c.notnull === 1,
          dflt_value: c.dflt_value,
          pk: c.pk > 0
        }));
      }
    }

    res.json({ success: true, tables: schemaMap });
  } catch (error) {
    console.error('Error fetching schema for query studio:', error);
    res.status(500).json({ success: false, error: error.message, message: error.message });
  }
});

module.exports = router;
