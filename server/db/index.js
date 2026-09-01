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