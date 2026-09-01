/**
 * seed.js — Migrates all existing mock data into the MySQL database.
 * Run: node server/db/seed.js
 */
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { initDb, getPool } = require('./index');

// Mock Users
const MOCK_USERS = [
  { id: 'admin',     name: 'Admin User',       dept: 'Administration',                     role: 'admin', password: 'admin' },
  { id: '2023-0001', name: 'Juan Dela Cruz',   dept: 'Col. of Business Administration',    role: 'user',  password: 'plsp1234' },
];

// Initial handbook versions
const INITIAL_VERSIONS = [
  {
    label: 'Version 2.0',
    description: 'Updated disciplinary procedures and added Safe Spaces Act provisions. Revised grading system aligned with CHED CMO 2025.',
    sections: 9,
    status: 'active',
    edited_by: 'Admin User',
    release_date: '2025-08-01',
  },
  {
    label: 'Version 1.0',
    description: 'Original digital handbook based on the 2018 ordinance from Sangguniang Panlungsod ng San Pablo.',
    sections: 8,
    status: 'inactive',
    edited_by: 'Admin User',
    release_date: '2024-06-15',
  },
];

function loadOrdinancesFromFile() {
  const filePath = path.join(__dirname, '../../src/data/ordinances.js');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/export\s+const\s+ORDINANCES\s*=\s*(\[[\s\S]*\]);?\s*$/m);
  if (!match) throw new Error('Could not parse ordinances.js');
  const fn = new Function(`return ${match[1]}`);
  return fn();
}

async function seed() {
  console.log('🌱 Starting MySQL seed...');

  // Initialize DB and tables
  await initDb();
  const pool = await getPool();

  // ─── Seed Users ───
  console.log('👤 Seeding users...');
  for (const u of MOCK_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(`
      INSERT INTO users (id, name, dept, role, password_hash)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        dept = VALUES(dept),
        role = VALUES(role),
        password_hash = VALUES(password_hash)
    `, [u.id, u.name, u.dept, u.role, hash]);
    console.log(`   ✓ ${u.id} (${u.role})`);
  }

  // ─── Seed Ordinances ───
  try {
    const ordinances = loadOrdinancesFromFile();
    console.log(`📋 Seeding ${ordinances.length} ordinances...`);
    for (const o of ordinances) {
      await pool.query(`
        INSERT INTO ordinances (id, ref, cat_key, cat, title, \`desc\`, summary, full_text, steps, related, handbook_section_id, status, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          ref        = VALUES(ref),
          cat_key    = VALUES(cat_key),
          cat        = VALUES(cat),
          title      = VALUES(title),
          \`desc\`   = VALUES(\`desc\`),
          summary    = VALUES(summary),
          full_text  = VALUES(full_text),
          steps      = VALUES(steps),
          related    = VALUES(related),
          handbook_section_id = VALUES(handbook_section_id)
      `, [
        o.id,
        o.ref,
        o.catK || 'conduct',
        o.cat  || 'Student Conduct',
        o.title,
        o.desc    || '',
        o.summary || '',
        o.full    || '',
        JSON.stringify(o.steps   || []),
        JSON.stringify(o.related || []),
        o.handbookSectionId || null,
        o.status  || 'published',
        'Admin User',
      ]);
    }
    console.log(`   ✓ ${ordinances.length} ordinances seeded`);
  } catch (err) {
    console.error('⚠️  Could not auto-load ordinances:', err.message);
    console.log('   Skipping ordinances — add them manually via Admin panel.');
  }

  // ─── Seed Versions ───
  console.log('📖 Seeding handbook versions...');
  for (const v of INITIAL_VERSIONS) {
    // Only insert if no versions exist (don't overwrite on re-seed)
    const [existing] = await pool.query('SELECT id FROM versions WHERE label = ?', [v.label]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO versions (label, description, sections, status, edited_by, release_date) VALUES (?, ?, ?, ?, ?, ?)',
        [v.label, v.description, v.sections, v.status, v.edited_by, v.release_date]
      );
      console.log(`   ✓ ${v.label}`);
    } else {
      console.log(`   – ${v.label} already exists, skipping`);
    }
  }

  await pool.end();
  console.log('\n🎉 MySQL seed complete!');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
