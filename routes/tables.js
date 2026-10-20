const express = require('express');
const router = express.Router();
const { query, execute, REQUIRED_TABLES, getEngineType } = require('../database');

// Middleware to validate table name
function validateTableName(req, res, next) {
  const rawName = req.params.tableName;
  const upperName = (rawName || '').toUpperCase();
  if (!REQUIRED_TABLES.includes(upperName)) {
    return res.status(404).json({
      success: false,
      message: `Table '${rawName}' is not one of the 18 application database tables.`
    });
  }
  req.tableName = upperName;
  next();
}

/**
 * Universal helper to get column and foreign key metadata
 */
async function getTableMetadata(table) {
  const engine = getEngineType();

  if (engine === 'postgres') {
    const rawCols = await query(`
      SELECT 
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
           AND lower(tc.table_name) = lower($1) 
           AND kcu.column_name = c.column_name
         LIMIT 1) as columnkey
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND lower(c.table_name) = lower($1)
      ORDER BY c.ordinal_position ASC;
    `, [table]);

    const rawFks = await query(`
      SELECT 
        kcu.column_name as from,
        ccu.table_name as table,
        ccu.column_name as to
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND lower(tc.table_name) = lower($1);
    `, [table]);

    const columns = rawCols.map(c => {
      const isPk = c.columnkey === 'PRI';
      const fkMatch = rawFks.find(f => f.from.toLowerCase() === c.name.toLowerCase());
      const isFk = Boolean(fkMatch);

      let keyBadge = null;
      if (isPk && isFk) {
        keyBadge = 'PK, FK';
      } else if (isPk) {
        keyBadge = 'PK';
      } else if (isFk) {
        keyBadge = 'FK';
      }

      return {
        name: c.name,
        type: (c.fulltype || c.type || 'VARCHAR').toUpperCase(),
        notnull: c.isnullable === 'NO',
        dflt_value: c.dflt_value,
        pkOrder: isPk ? 1 : 0,
        isPk,
        isFk,
        keyBadge,
        fkRef: fkMatch ? { table: fkMatch.table, to: fkMatch.to } : null
      };
    });

    return { columns, rawFks };
  } else if (engine === 'mysql') {
    const rawCols = await query(`
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        COLUMN_TYPE as fullType,
        IS_NULLABLE as isNullable,
        COLUMN_DEFAULT as dflt_value,
        COLUMN_KEY as columnKey,
        ORDINAL_POSITION as ordinalPosition
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION ASC;
    `, [table]);

    const rawFks = await query(`
      SELECT 
        COLUMN_NAME as \`from\`,
        REFERENCED_TABLE_NAME as \`table\`,
        REFERENCED_COLUMN_NAME as \`to\`
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL;
    `, [table]);

    const columns = rawCols.map(c => {
      const isPk = c.columnKey === 'PRI';
      const fkMatch = rawFks.find(f => f.from === c.name);
      const isFk = Boolean(fkMatch);

      let keyBadge = null;
      if (isPk && isFk) {
        keyBadge = 'PK, FK';
      } else if (isPk) {
        keyBadge = 'PK';
      } else if (isFk) {
        keyBadge = 'FK';
      }

      return {
        name: c.name,
        type: (c.fullType || c.type || 'VARCHAR(255)').toUpperCase(),
        notnull: c.isNullable === 'NO',
        dflt_value: c.dflt_value,
        pkOrder: isPk ? 1 : 0,
        isPk,
        isFk,
        keyBadge,
        fkRef: fkMatch ? { table: fkMatch.table, to: fkMatch.to } : null
      };
    });

    return { columns, rawFks };
  } else {
    // SQLite fallback
    const rawCols = await query(`PRAGMA table_info("${table}")`);
    const rawFks = await query(`PRAGMA foreign_key_list("${table}")`);

    const columns = rawCols.map(c => {
      const isPk = c.pk > 0;
      const fkMatch = rawFks.find(f => f.from === c.name);
      const isFk = Boolean(fkMatch);

      let keyBadge = null;
      if (isPk && isFk) {
        keyBadge = 'PK, FK';
      } else if (isPk) {
        keyBadge = 'PK';
      } else if (isFk) {
        keyBadge = 'FK';
      }

      return {
        name: c.name,
        type: c.type || 'TEXT',
        notnull: c.notnull === 1,
        dflt_value: c.dflt_value,
        pkOrder: c.pk,
        isPk,
        isFk,
        keyBadge,
        fkRef: fkMatch ? { table: fkMatch.table, to: fkMatch.to } : null
      };
    });

    return { columns, rawFks };
  }
}

// GET all 18 table summaries
router.get('/', async (req, res) => {
  try {
    const list = [];
    for (const table of REQUIRED_TABLES) {
      const [countRow] = await query(`SELECT count(*) as count FROM \`${table}\``);
      const { columns } = await getTableMetadata(table);
      list.push({
        name: table,
        rowCount: Number(countRow?.count || 0),
        columnCount: columns.length,
        hasCompositeKey: columns.filter(c => c.isPk).length > 1
      });
    }
    res.json({ success: true, count: list.length, tables: list });
  } catch (err) {
    console.error('Error fetching table list:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET specific table schema and all records
router.get('/:tableName', validateTableName, async (req, res) => {
  try {
    const table = req.tableName;
    const { search } = req.query;

    const { columns, rawFks } = await getTableMetadata(table);
    const primaryKeys = columns.filter(c => c.isPk).map(c => c.name);

    let sql = `SELECT * FROM \`${table}\``;
    const params = [];

    if (search && search.trim()) {
      const searchTerms = columns
        .filter(c => c.type.includes('CHAR') || c.type.includes('TEXT') || c.type.includes('INT'))
        .map(c => `CAST(\`${c.name}\` AS CHAR) LIKE ?`);
      if (searchTerms.length > 0) {
        sql += ` WHERE ${searchTerms.join(' OR ')}`;
        const s = `%${search.trim()}%`;
        searchTerms.forEach(() => params.push(s));
      }
    }

    if (primaryKeys.length > 0) {
      sql += ` ORDER BY ${primaryKeys.map(k => `\`${k}\` ASC`).join(', ')}`;
    }

    const rows = await query(sql, params);
    const [countRow] = await query(`SELECT count(*) as count FROM \`${table}\``);
    const totalCount = Number(countRow?.count || 0);

    res.json({
      success: true,
      tableName: table,
      columns,
      primaryKeys,
      foreignKeys: rawFks.map(f => ({ from: f.from, table: f.table, to: f.to })),
      totalRows: totalCount,
      filteredRows: rows.length,
      data: rows
    });
  } catch (err) {
    console.error(`Error querying table '${req.params.tableName}':`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST insert new record into table
router.post('/:tableName', validateTableName, async (req, res) => {
  try {
    const table = req.tableName;
    const body = req.body || {};

    const { columns } = await getTableMetadata(table);
    const insertCols = [];
    const insertVals = [];
    const placeholders = [];

    for (const col of columns) {
      const val = body[col.name];
      if (val !== undefined && val !== '') {
        insertCols.push(`\`${col.name}\``);
        insertVals.push(val);
        placeholders.push('?');
      }
    }

    if (insertCols.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid column values provided' });
    }

    const sql = `INSERT INTO \`${table}\` (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const result = await execute(sql, insertVals);

    res.status(201).json({
      success: true,
      message: `Record added to ${table} successfully`,
      lastInsertRowid: result.insertId || result.lastInsertRowid
    });
  } catch (err) {
    console.error(`Error inserting into ${req.params.tableName}:`, err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update record in table
router.put('/:tableName', validateTableName, async (req, res) => {
  try {
    const table = req.tableName;
    const { keyCriteria, values } = req.body;

    if (!keyCriteria || !values || typeof keyCriteria !== 'object' || typeof values !== 'object') {
      return res.status(400).json({ success: false, message: 'keyCriteria and values objects are required' });
    }

    const setClauses = [];
    const params = [];

    for (const [col, val] of Object.entries(values)) {
      setClauses.push(`\`${col}\` = ?`);
      params.push(val === '' ? null : val);
    }

    const whereClauses = [];
    for (const [pkCol, pkVal] of Object.entries(keyCriteria)) {
      whereClauses.push(`\`${pkCol}\` = ?`);
      params.push(pkVal);
    }

    if (setClauses.length === 0 || whereClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing update fields or target key criteria' });
    }

    const sql = `UPDATE \`${table}\` SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    const result = await execute(sql, params);

    const affected = result.affectedRows !== undefined ? result.affectedRows : result.changes;
    if (affected === 0) {
      return res.status(404).json({ success: false, message: 'No record matched the key criteria' });
    }

    res.json({ success: true, message: `Record in ${table} updated successfully` });
  } catch (err) {
    console.error(`Error updating record in ${req.params.tableName}:`, err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE record from table
router.delete('/:tableName', validateTableName, async (req, res) => {
  try {
    const table = req.tableName;
    const keyCriteria = req.query;

    const { columns } = await getTableMetadata(table);
    const pkCols = columns.filter(c => c.isPk).map(c => c.name);

    if (pkCols.length === 0) {
      return res.status(400).json({ success: false, message: 'Table has no primary key defined' });
    }

    const whereClauses = [];
    const params = [];

    for (const pk of pkCols) {
      if (keyCriteria[pk] === undefined) {
        return res.status(400).json({
          success: false,
          message: `Missing primary key parameter '${pk}' for deleting from ${table}`
        });
      }
      whereClauses.push(`\`${pk}\` = ?`);
      params.push(keyCriteria[pk]);
    }

    const sql = `DELETE FROM \`${table}\` WHERE ${whereClauses.join(' AND ')}`;
    const result = await execute(sql, params);

    const affected = result.affectedRows !== undefined ? result.affectedRows : result.changes;
    if (affected === 0) {
      return res.status(404).json({ success: false, message: 'No record matched the primary key' });
    }

    res.json({ success: true, message: `Record deleted from ${table} successfully` });
  } catch (err) {
    console.error(`Error deleting from ${req.params.tableName}:`, err);
    if (err.message.includes('FOREIGN KEY') || err.message.includes('a foreign key constraint fails')) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete record: Other tables reference this record via Foreign Key constraint.`
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
