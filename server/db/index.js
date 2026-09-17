const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
});

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'plawminary',

  ssl: process.env.DB_SSL === 'true'
    ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
    : undefined,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(config);
  }

  return pool;
}

async function initDb() {
  const { database, ...serverConfig } = config;

  try {
    if (process.env.DB_CREATE_DATABASE === 'true') {
      const serverConn = await mysql.createConnection(serverConfig);

      await serverConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\`
         CHARACTER SET utf8mb4
         COLLATE utf8mb4_unicode_ci;`
      );

      await serverConn.end();
    }

    const dbPool = await getPool();

    // 3. Apply schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    const initConn = await mysql.createConnection({
      ...config,
      multipleStatements: true
    });

    await initConn.query(schemaSql);

    // 4. Safe migrations
    const migrations = [
      {
        table: 'users',
        column: 'email',
        sql: `
          ALTER TABLE users
          ADD COLUMN email VARCHAR(255) NULL UNIQUE
        `,
      },
      {
        table: 'ordinances',
        column: 'status',
        sql: `
          ALTER TABLE ordinances
          ADD COLUMN status VARCHAR(32)
          NOT NULL DEFAULT 'published'
        `,
      },
      {
        table: 'ordinances',
        column: 'updated_by',
        sql: `
          ALTER TABLE ordinances
          ADD COLUMN updated_by VARCHAR(255) NULL
        `,
      },
      {
        table: 'comments',
        column: 'resolved',
        sql: `
          ALTER TABLE comments
          ADD COLUMN resolved TINYINT(1)
          NOT NULL DEFAULT 0
        `,
      },
      {
        table: 'ordinances',
        column: 'page',
        sql: `
          ALTER TABLE ordinances
          ADD COLUMN page INT NULL
        `,
      },
      {
        table: 'ordinances',
        column: 'version_id',
        sql: `
          ALTER TABLE ordinances
          ADD COLUMN version_id INT NULL
        `,
      },
      {
        table: 'versions',
        column: 'file_path',
        sql: `
          ALTER TABLE versions
          ADD COLUMN file_path VARCHAR(512) NULL
        `,
      },
      {
        table: 'versions',
        column: 'change_notes',
        sql: `
          ALTER TABLE versions
          ADD COLUMN change_notes TEXT NULL
        `,
      },
      {
        table: 'users',
        column: 'student_record_id',
        sql: `
          ALTER TABLE users
          ADD COLUMN student_record_id INT NULL
        `,
      },
    ];

    for (const migration of migrations) {
      try {
        const [columns] = await initConn.query(
          `SHOW COLUMNS FROM \`${migration.table}\` LIKE ?`,
          [migration.column]
        );

        if (columns.length === 0) {
          await initConn.query(migration.sql);

          console.log(
            `  ✅ Added ${migration.table}.${migration.column}`
          );
        } else {
          console.log(
            `  ✓ ${migration.table}.${migration.column} already exists`
          );
        }
      } catch (e) {
        console.warn(
          `  ⚠️ Migration failed for ${migration.table}.${migration.column}:`,
          e.message
        );
      }
    }

    // ── Table-level migrations (idempotent CREATE TABLE IF NOT EXISTS) ─────────
    const tableMigrations = [
      {
        name: 'import_batches',
        sql: `
          CREATE TABLE IF NOT EXISTS import_batches (
            id            VARCHAR(64) PRIMARY KEY,
            filename      VARCHAR(255) NOT NULL,
            total_records INT NOT NULL DEFAULT 0,
            imported_by   VARCHAR(255) NOT NULL,
            created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
      {
        name: 'student_records',
        sql: `
          CREATE TABLE IF NOT EXISTS student_records (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            student_no      VARCHAR(64) NOT NULL UNIQUE,
            email           VARCHAR(255) NOT NULL UNIQUE,
            department      VARCHAR(255) NOT NULL,
            program         VARCHAR(255) NOT NULL,
            full_name       VARCHAR(255) NULL,
            is_registered   TINYINT(1) NOT NULL DEFAULT 0,
            import_batch_id VARCHAR(64) NOT NULL,
            registered_at   TIMESTAMP NULL,
            created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sr_email (email),
            INDEX idx_sr_batch (import_batch_id),
            INDEX idx_sr_lookup (student_no, email)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
      {
        name: 'policy_scenarios',
        sql: `
          CREATE TABLE IF NOT EXISTS policy_scenarios (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            policy_id  INT NOT NULL,
            scenario   TEXT NOT NULL,
            keywords   JSON NULL,
            synonyms   JSON NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ps_policy (policy_id),
            CONSTRAINT fk_ps_policy FOREIGN KEY (policy_id)
              REFERENCES ordinances(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
    ];

    for (const tm of tableMigrations) {
      try {
        await initConn.query(tm.sql);
        console.log(`  ✓ Table '${tm.name}' ensured`);
      } catch (e) {
        console.warn(`  ⚠️ Table migration '${tm.name}' failed:`, e.message);
      }
    }

    // ── Index & Version Integrity Migrations ─────────────────────────────────
    try {
      // 1. Drop global UNIQUE constraint on ordinances.ref if present so versions can hold historical records
      const [ordIndexes] = await initConn.query('SHOW INDEX FROM ordinances');
      const hasUniqueRef = ordIndexes.some(idx => idx.Key_name === 'ref' && idx.Non_unique === 0);
      if (hasUniqueRef) {
        await initConn.query('ALTER TABLE ordinances DROP INDEX `ref`');
        console.log('  ✅ Dropped global UNIQUE constraint on ordinances.ref');
      }

      // 2. Ensure non-unique lookup index on ref
      const hasRefIndex = ordIndexes.some(idx => idx.Key_name === 'idx_ord_ref' || idx.Key_name === 'ref');
      if (!hasRefIndex) {
        await initConn.query('ALTER TABLE ordinances ADD INDEX idx_ord_ref (ref)');
        console.log('  ✅ Added idx_ord_ref index on ordinances(ref)');
      }

      // 3. Ensure composite UNIQUE constraint on (ref, version_id)
      const hasCompositeUnique = ordIndexes.some(idx => idx.Key_name === 'uq_ord_ref_version');
      if (!hasCompositeUnique) {
        try {
          await initConn.query('ALTER TABLE ordinances ADD UNIQUE KEY uq_ord_ref_version (ref, version_id)');
          console.log('  ✅ Added composite UNIQUE KEY uq_ord_ref_version (ref, version_id)');
        } catch (e) {
          console.warn('  ⚠️ Note: composite unique key could not be added:', e.message);
        }
      }

      // 4. Normalize legacy 'inactive' versions to 'archived'
      await initConn.query("UPDATE versions SET status = 'archived' WHERE status = 'inactive'");

      // 5. Ensure single active version: if no active version exists, activate latest; if multiple, archive older ones
      const [activeVersions] = await initConn.query("SELECT id FROM versions WHERE status = 'active' ORDER BY release_date DESC, id DESC");
      let activeVersionId = null;
      if (activeVersions.length > 0) {
        activeVersionId = activeVersions[0].id;
        if (activeVersions.length > 1) {
          const olderIds = activeVersions.slice(1).map(v => v.id);
          await initConn.query(`UPDATE versions SET status = 'archived' WHERE id IN (?)`, [olderIds]);
          console.log(`  ✅ Normalized multiple active versions, archived older IDs: ${olderIds.join(', ')}`);
        }
      } else {
        const [latestVersion] = await initConn.query("SELECT id FROM versions ORDER BY release_date DESC, id DESC LIMIT 1");
        if (latestVersion.length > 0) {
          activeVersionId = latestVersion[0].id;
          await initConn.query("UPDATE versions SET status = 'active' WHERE id = ?", [activeVersionId]);
          console.log(`  ✅ Activated latest version ID ${activeVersionId}`);
        }
      }

      // 6. Data reconciliation: attach unassigned ordinances (version_id IS NULL) to active version so they remain accessible
      if (activeVersionId) {
        const [orphanResult] = await initConn.query(
          "UPDATE ordinances SET version_id = ? WHERE version_id IS NULL",
          [activeVersionId]
        );
        if (orphanResult.affectedRows > 0) {
          console.log(`  ✅ Linked ${orphanResult.affectedRows} baseline ordinances to active version ID ${activeVersionId}`);
        }

        // Update version sections count
        await initConn.query(
          `UPDATE versions v SET sections = (SELECT COUNT(*) FROM ordinances o WHERE o.version_id = v.id)`
        );
      }
    } catch (integrityErr) {
      console.warn('  ⚠️ Version integrity migration warning:', integrityErr.message);
    }

    await initConn.end();

    console.log(
      `✅ MySQL database '${database}' and tables initialized successfully.`
    );

    return dbPool;

  } catch (err) {
    console.error(
      '❌ Failed to initialize MySQL database:',
      err.message
    );

    throw err;
  }
}

module.exports = {
  getPool,
  initDb,
  config,
};