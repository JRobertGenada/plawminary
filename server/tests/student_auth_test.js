/**
 * server/tests/student_auth_test.js
 * End-to-end and unit automated tests for Student Master List Authentication.
 *
 * Covers:
 * 1. Unauthorized uploader access (401 / 403)
 * 2. Invalid CSV/XLSX format (missing required columns, corrupt data)
 * 3. Duplicate import records detection (in-file duplicates and DB conflicts)
 * 4. Import rollback on failure (transaction atomicity)
 * 5. Valid batch import (CSV & XLSX)
 * 6. Wrong student number rejection
 * 7. Wrong email rejection
 * 8. Mismatched passwords rejection
 * 9. Valid registration & transaction verification (users created, is_registered=1)
 * 10. Duplicate registration rejection (409)
 * 11. Student login verification (via student_no and email)
 */

const http = require('http');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcrypt');
const { getPool, initDb } = require('../db');

// Helper to send HTTP requests to the running server
function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { ...headers },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

// Multipart form builder helper for file upload without external dependencies
function buildMultipartFormData(fieldName, fileName, fileBuffer, mimeType) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const prefix = Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${crlf}` +
    `Content-Type: ${mimeType}${crlf}${crlf}`
  );
  const suffix = Buffer.from(`${crlf}--${boundary}--${crlf}`);
  const payload = Buffer.concat([prefix, fileBuffer, suffix]);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload,
  };
}

async function runTests() {
  console.log('🚀 Starting Student Master List Authentication Test Suite...\n');

  // Initialize DB
  const db = await initDb();

  // Clean test tables
  const testStudentId1 = 'TEST-2026-001';
  const testEmail1     = 'test.student1@plsp.edu.ph';
  const testStudentId2 = 'TEST-2026-002';
  const testEmail2     = 'test.student2@plsp.edu.ph';

  await db.query('DELETE FROM users WHERE id IN (?, ?)', [testStudentId1, testStudentId2]);
  await db.query('DELETE FROM student_records WHERE student_no IN (?, ?)', [testStudentId1, testStudentId2]);

  // Ensure an admin user exists for test
  const [adminRows] = await db.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  let adminId = 'admin';
  if (adminRows.length === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    await db.query(
      "INSERT INTO users (id, name, dept, role, password_hash) VALUES ('admin', 'System Admin', 'IT', 'admin', ?)",
      [adminHash]
    );
  } else {
    adminId = adminRows[0].id;
  }

  // Boot test Express app on ephemeral port
  const express = require('express');
  const session = require('express-session');
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }));

  app.use('/api/auth',           require('../routes/auth')(db));
  app.use('/api/admin/students', require('../routes/students')(db));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  console.log(`📡 Test server running on http://127.0.0.1:${port}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ── Test 1: Unauthorized Uploader Access (No session) ───────────────────
    console.log('\n--- 1. Unauthorized Uploader Access ---');
    const unauthPreview = await makeRequest(port, 'POST', '/api/admin/students/preview');
    assert(unauthPreview.status === 401, 'Unauthenticated access to preview rejected with 401');

    const unauthImport = await makeRequest(port, 'POST', '/api/admin/students/import', {}, { records: [] });
    assert(unauthImport.status === 401, 'Unauthenticated access to import rejected with 401');

    // Authenticate as Admin to obtain session cookie
    console.log('\n--- Logging in as Admin ---');
    const newAdminHash = await bcrypt.hash('admin', 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newAdminHash, adminId]);

    const adminLoginRes = await makeRequest(port, 'POST', '/api/auth/login', {}, {
      studentId: adminId,
      password: 'admin',
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data.success, 'Admin login succeeded');

    const cookieHeader = adminLoginRes.headers['set-cookie'];
    const adminCookie = cookieHeader ? cookieHeader[0].split(';')[0] : '';
    const adminHeaders = { Cookie: adminCookie };

    // ── Test 2: Invalid CSV/XLSX Format ─────────────────────────────────────
    console.log('\n--- 2. Invalid CSV/XLSX Format ---');
    // Missing required columns: only student_no, email (missing department, program)
    const invalidCsv = 'student_no,email\nTEST-001,test@example.com\n';
    const formInvalid = buildMultipartFormData('file', 'test_invalid.csv', Buffer.from(invalidCsv), 'text/csv');
    const invalidRes = await makeRequest(
      port, 'POST', '/api/admin/students/preview',
      { ...adminHeaders, 'Content-Type': formInvalid.contentType },
      formInvalid.payload
    );
    assert(invalidRes.status === 400, 'Upload missing required columns rejected with 400');
    assert(invalidRes.data.error.includes('department') && invalidRes.data.error.includes('program'),
      'Error response lists missing columns');

    // ── Test 3: Duplicate Import Records Detection ───────────────────────────
    console.log('\n--- 3. Duplicate Import Records Detection ---');
    // CSV with in-file duplicate student_no and invalid email
    const duplicateCsv =
      'student_no,email,department,program,full_name\n' +
      `${testStudentId1},${testEmail1},CCST,BSIT,Test Student One\n` +
      `${testStudentId1},another.email@plsp.edu.ph,CCST,BSIT,Duplicate SNo\n` +
      `TEST-BAD-EMAIL,invalid-email-syntax,CCST,BSIT,Bad Email Student\n`;

    const formDup = buildMultipartFormData('file', 'test_duplicates.csv', Buffer.from(duplicateCsv), 'text/csv');
    const dupRes = await makeRequest(
      port, 'POST', '/api/admin/students/preview',
      { ...adminHeaders, 'Content-Type': formDup.contentType },
      formDup.payload
    );

    assert(dupRes.status === 200, 'Preview endpoint parsed duplicate test file');
    assert(dupRes.data.validCount === 1, 'Correctly identified exactly 1 valid row');
    assert(dupRes.data.invalidCount === 2, 'Correctly flagged 2 invalid rows');
    assert(
      dupRes.data.invalidRows.some(r => r.errors.some(e => e.includes('Duplicate student number'))),
      'Correctly detected in-file duplicate student number'
    );
    assert(
      dupRes.data.invalidRows.some(r => r.errors.some(e => e.includes('Invalid email format'))),
      'Correctly detected invalid email format'
    );

    // ── Test 4: Import Rollback on Failure ───────────────────────────────────
    console.log('\n--- 4. Import Rollback on Failure ---');
    // Attempt import with an intentional duplicate key to trigger transaction rollback
    // First, insert a mock record
    await db.query(
      `INSERT INTO student_records (student_no, email, department, program, is_registered, import_batch_id)
       VALUES (?, ?, 'CCST', 'BSIT', 0, 'mock_batch')`,
      [testStudentId1, testEmail1]
    );

    const conflictingBatch = [
      { student_no: testStudentId2, email: testEmail2, department: 'CCST', program: 'BSIT' },
      { student_no: testStudentId1, email: testEmail1, department: 'CCST', program: 'BSIT' }, // triggers ER_DUP_ENTRY
    ];

    const rollbackRes = await makeRequest(port, 'POST', '/api/admin/students/import', adminHeaders, {
      records: conflictingBatch,
      filename: 'conflicting.csv',
    });

    assert(rollbackRes.status === 409, 'Duplicate batch import rejected with 409 conflict');

    // Verify testStudentId2 was NOT saved due to transaction rollback
    const [checkStudent2] = await db.query('SELECT * FROM student_records WHERE student_no = ?', [testStudentId2]);
    assert(checkStudent2.length === 0, 'Transaction rolled back completely; student 2 was not persisted');

    // Clean up mock record
    await db.query('DELETE FROM student_records WHERE student_no IN (?, ?)', [testStudentId1, testStudentId2]);

    // ── Test 5: Successful Batch Import (CSV and XLSX) ───────────────────────
    console.log('\n--- 5. Successful Batch Import (XLSX Format) ---');
    // Create XLSX workbook in memory
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['student_no', 'email', 'department', 'program', 'full_name'],
      [testStudentId1, testEmail1, 'College of Computer Studies and Technology (CCST)', 'BS Information Technology', 'Test Student 1'],
      [testStudentId2, testEmail2, 'College of Business Administration', 'BS Accountancy', 'Test Student 2'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const formXlsx = buildMultipartFormData(
      'file', 'official_roster.xlsx', xlsxBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const xlsxPreviewRes = await makeRequest(
      port, 'POST', '/api/admin/students/preview',
      { ...adminHeaders, 'Content-Type': formXlsx.contentType },
      formXlsx.payload
    );

    assert(xlsxPreviewRes.status === 200, 'XLSX preview endpoint succeeded');
    assert(xlsxPreviewRes.data.validCount === 2, 'Parsed 2 valid rows from XLSX file');

    // Commit the import
    const importCommitRes = await makeRequest(port, 'POST', '/api/admin/students/import', adminHeaders, {
      records: xlsxPreviewRes.data.validRows,
      filename: 'official_roster.xlsx',
    });

    assert(importCommitRes.status === 201 && importCommitRes.data.success, 'Committed XLSX import transaction successfully');

    // Verify records exist in database
    const [dbCheckRecords] = await db.query(
      'SELECT * FROM student_records WHERE student_no IN (?, ?)',
      [testStudentId1, testStudentId2]
    );
    assert(dbCheckRecords.length === 2, 'Both student records present in student_records table with is_registered = 0');

    // ── Test 6: Registration - Wrong Student Number ─────────────────────────
    console.log('\n--- 6. Registration: Wrong Student Number ---');
    const wrongSNoRes = await makeRequest(port, 'POST', '/api/auth/register', {}, {
      studentId: 'NON-EXISTENT-999',
      email: testEmail1,
      password: 'password123',
      confirmPassword: 'password123',
    });
    assert(wrongSNoRes.status === 400, 'Registration with non-matching student number rejected with 400');
    assert(wrongSNoRes.data.error.includes('not found in the authorized master list'),
      'Appropriate error message returned for unmatched record');

    // ── Test 7: Registration - Wrong Email ──────────────────────────────────
    console.log('\n--- 7. Registration: Wrong Email ---');
    const wrongEmailRes = await makeRequest(port, 'POST', '/api/auth/register', {}, {
      studentId: testStudentId1,
      email: 'wrong.email@plsp.edu.ph',
      password: 'password123',
      confirmPassword: 'password123',
    });
    assert(wrongEmailRes.status === 400, 'Registration with non-matching email rejected with 400');

    // ── Test 8: Registration - Mismatched Passwords ─────────────────────────
    console.log('\n--- 8. Registration: Mismatched Passwords ---');
    const mismatchPwRes = await makeRequest(port, 'POST', '/api/auth/register', {}, {
      studentId: testStudentId1,
      email: testEmail1,
      password: 'password123',
      confirmPassword: 'differentPassword456',
    });
    assert(mismatchPwRes.status === 400, 'Registration with mismatched passwords rejected with 400');

    // ── Test 9: Valid Student Registration & Transaction ────────────────────
    console.log('\n--- 9. Valid Student Registration & Transaction ---');
    const validRegRes = await makeRequest(port, 'POST', '/api/auth/register', {}, {
      studentId: testStudentId1,
      email: testEmail1,
      fullName: 'Registered Student One',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    });

    assert(validRegRes.status === 201 && validRegRes.data.success, 'Registration succeeded with 201 Created');

    // Verify account in users table
    const [userRow] = await db.query('SELECT * FROM users WHERE id = ?', [testStudentId1]);
    assert(userRow.length === 1, 'User account exists in users table');
    assert(userRow[0].email === testEmail1.toLowerCase(), 'User email matches normalized email');
    assert(userRow[0].dept === 'College of Computer Studies and Technology (CCST)', 'User department populated from master list');

    // Verify master record marked as registered
    const [masterRec] = await db.query('SELECT * FROM student_records WHERE student_no = ?', [testStudentId1]);
    assert(masterRec[0].is_registered === 1, 'Master record is_registered set to 1');
    assert(masterRec[0].registered_at !== null, 'Master record registered_at timestamp recorded');

    // ── Test 10: Duplicate Registration Rejection ───────────────────────────
    console.log('\n--- 10. Duplicate Registration Rejection ---');
    const dupRegRes = await makeRequest(port, 'POST', '/api/auth/register', {}, {
      studentId: testStudentId1,
      email: testEmail1,
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    });
    assert(dupRegRes.status === 409, 'Duplicate registration attempt rejected with 409 conflict');

    // ── Test 11: Student Login Verification ─────────────────────────────────
    console.log('\n--- 11. Student Login Verification ---');
    // Login with Student ID
    const studentLoginIdRes = await makeRequest(port, 'POST', '/api/auth/login', {}, {
      studentId: testStudentId1,
      password: 'SecurePassword123!',
    });
    assert(studentLoginIdRes.status === 200 && studentLoginIdRes.data.user.id === testStudentId1,
      'Student login with Student ID succeeded');

    // Login with Email
    const studentLoginEmailRes = await makeRequest(port, 'POST', '/api/auth/login', {}, {
      studentId: testEmail1,
      password: 'SecurePassword123!',
    });
    assert(studentLoginEmailRes.status === 200 && studentLoginEmailRes.data.user.id === testStudentId1,
      'Student login with Email succeeded');

    // Clean up test data
    await db.query('DELETE FROM users WHERE id IN (?, ?)', [testStudentId1, testStudentId2]);
    await db.query('DELETE FROM student_records WHERE student_no IN (?, ?)', [testStudentId1, testStudentId2]);

    // ── Test 12: Header-Row Auto-Detection (PLSP Master List Format) ─────────
    console.log('\n--- 12. Header-Row Auto-Detection ---');

    // 12a — XLSX with 4 title rows above real headers (mirrors the actual PLSP export)
    console.log('  12a. Title rows before real headers');
    {
      const wb = XLSX.utils.book_new();
      const wsData = [
        // Title rows (should be skipped)
        ['PAMANTASAN NG LUNGSOD NG SAN PABLO'],
        ['PLSP Student Master List — AY 2026-2027'],
        [],
        [],
        // Real header row (row 5 in 1-based)
        ['Student No.', 'Last Name', 'First Name', 'Middle Name', 'Department (College)', 'Program', 'Email'],
        // Data rows
        [testStudentId1, 'Dela Cruz', 'Juan', 'Santos', 'College of Computer Studies and Technology (CCST)', 'BS Information Technology', testEmail1],
        [testStudentId2, 'Santos',    'Maria', '',      'College of Business Administration',               'BS Accountancy',          testEmail2],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const form = buildMultipartFormData(
        'file', 'plsp_master_list.xlsx', buf,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const res12a = await makeRequest(
        port, 'POST', '/api/admin/students/preview',
        { ...adminHeaders, 'Content-Type': form.contentType },
        form.payload
      );
      assert(res12a.status === 200, '12a: Preview succeeded despite title rows');
      assert(res12a.data.validCount === 2, '12a: Detected exactly 2 valid data rows after skipping title rows');
      assert(
        res12a.data.validRows.every(r => r.student_no && r.email && r.department && r.program),
        '12a: All required fields populated for each row'
      );
      // Verify first/last/middle assembled into full_name
      assert(
        res12a.data.validRows[0].full_name === 'Dela Cruz, Juan, Santos' ||
        res12a.data.validRows[0].full_name.includes('Dela Cruz'),
        '12a: full_name assembled from Last/First/Middle columns'
      );
    }

    // 12b — CSV using exact real-file alias headers (Student No., Department (College), etc.)
    console.log('  12b. Exact real-file header aliases (CSV)');
    {
      const aliasCsv =
        '"Student No.","Last Name","First Name","Middle Name","Department (College)","Program","Email"\n' +
        `"${testStudentId1}","Reyes","Carlo","","College of Nursing","BS Nursing","${testEmail1}"\n`;
      const form = buildMultipartFormData('file', 'alias_test.csv', Buffer.from(aliasCsv), 'text/csv');
      const res12b = await makeRequest(
        port, 'POST', '/api/admin/students/preview',
        { ...adminHeaders, 'Content-Type': form.contentType },
        form.payload
      );
      assert(res12b.status === 200, '12b: Preview succeeded with real-file header aliases');
      assert(res12b.data.validCount === 1, '12b: Parsed 1 valid row from alias-header CSV');
      assert(res12b.data.validRows[0].department === 'College of Nursing', '12b: Department column correctly mapped');
      assert(res12b.data.validRows[0].student_no === testStudentId1, '12b: Student No. column correctly mapped');
    }

    // 12c — Interleaved blank rows are silently skipped
    console.log('  12c. Blank rows in data section skipped');
    {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Student No.', 'Email', 'Department (College)', 'Program'],
        [testStudentId1, testEmail1, 'College of Computer Studies and Technology (CCST)', 'BS Information Technology'],
        [],          // blank — should be skipped
        ['', '', '', ''],  // all-empty cells — should be skipped
        [testStudentId2, testEmail2, 'College of Business Administration', 'BS Accountancy'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Roster');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const form = buildMultipartFormData(
        'file', 'blank_rows.xlsx', buf,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const res12c = await makeRequest(
        port, 'POST', '/api/admin/students/preview',
        { ...adminHeaders, 'Content-Type': form.contentType },
        form.payload
      );
      assert(res12c.status === 200, '12c: Preview succeeded with blank rows present');
      assert(res12c.data.validCount === 2, '12c: Exactly 2 valid rows returned (blank rows not counted)');
    }

    // 12d — Corrupt / non-spreadsheet file sent with .xlsx extension returns 400
    console.log('  12d. Corrupt / plain-text file rejected with 400');
    {
      const garbage = Buffer.from('This is not a spreadsheet file at all. Just plain text.');
      const form = buildMultipartFormData(
        'file', 'corrupt.xlsx', garbage,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const res12d = await makeRequest(
        port, 'POST', '/api/admin/students/preview',
        { ...adminHeaders, 'Content-Type': form.contentType },
        form.payload
      );
      assert(res12d.status === 400, '12d: Corrupt file rejected with 400');
    }

    // ── Test 13: Merged-Cell Propagation (Real PLSP Excel Structure) ──────────
    console.log('\n--- 13. Merged-Cell Propagation (PLSP Format) ---');

    // 13a — Dept/program merged across 3 rows each: only first row has value.
    // Mimics the real master list where E6:E65 and F6:F10 are merged blocks.
    console.log('  13a. Merged dept + program cells propagated to all rows in block');
    {
      const wb = XLSX.utils.book_new();
      // Build worksheet manually using aoa_to_sheet then add merges
      const wsData = [
        // Rows 0-3: title rows (4 blank-ish rows)
        ['PAMANTASAN NG LUNGSOD NG SAN PABLO'],
        ['Semester AY 2025-2026'],
        [],
        [],
        // Row 4 (index): real headers
        ['Student No.', 'Last Name', 'First Name', 'Middle Name', 'Department (College)', 'Program', 'Email'],
        // Rows 5-7: same dept + same program (merged E6:E7, F6:F7 in 1-based = idx 5-6)
        ['25-10001', 'DELA CRUZ',  'JUAN',   'S.', 'College of Computer Studies and Technology', 'BS Information Technology', testEmail1],
        ['25-10002', 'SANTOS',     'MARIA',  'R.', '',                                           '',                          testEmail2],
        // Row 8: same dept, different program (E still merged, F changes)
        ['25-10003', 'REYES',      'CARLO',  'B.', '',  'BS Information Systems', 'carlo.reyes@students.plsp.edu.ph'],
        // Footer disclaimer row — should be skipped
        ['Total dummy accounts generated: 3. This is a sample file for testing only.', '', '', '', '', '', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Add merges: Department (col E = index 4) rows 5-7 (0-based indices)
      // Program (col F = index 5) rows 5-6 (same program for first two students)
      ws['!merges'] = [
        { s: { r: 5, c: 4 }, e: { r: 7, c: 4 } }, // dept merged rows 6-8 (1-based)
        { s: { r: 5, c: 5 }, e: { r: 6, c: 5 } }, // program merged rows 6-7 (1-based)
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Master List');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const form = buildMultipartFormData(
        'file', 'merged_cells.xlsx', buf,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const res13a = await makeRequest(
        port, 'POST', '/api/admin/students/preview',
        { ...adminHeaders, 'Content-Type': form.contentType },
        form.payload
      );

      assert(res13a.status === 200, '13a: Preview succeeded with merged cells');
      assert(res13a.data.validCount === 3, '13a: All 3 data rows are valid (not just the first in each merge block)');

      const rows13a = res13a.data.validRows;
      assert(
        rows13a.every(r => r.department === 'College of Computer Studies and Technology'),
        '13a: Department propagated from merged cell to all rows in the block'
      );
      assert(
        rows13a[0].program === 'BS Information Technology' &&
        rows13a[1].program === 'BS Information Technology',
        '13a: Program propagated within its own merge block'
      );
      assert(
        rows13a[2].program === 'BS Information Systems',
        '13a: Different program in second merge block correctly isolated'
      );
    }

    // 13b — Footer / disclaimer row is silently skipped
    console.log('  13b. Footer disclaimer row skipped');
    {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['Student No.', 'Email', 'Department (College)', 'Program'],
        [testStudentId1, testEmail1, 'College of Nursing', 'BS Nursing'],
        ['Total dummy accounts generated: 180. This is a dummy master list — all names, student numbers, and emails are for sample purposes only.', '', '', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const form = buildMultipartFormData(
        'file', 'footer_row.xlsx', buf,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const res13b = await makeRequest(
        port, 'POST', '/api/admin/students/preview',
        { ...adminHeaders, 'Content-Type': form.contentType },
        form.payload
      );
      assert(res13b.status === 200, '13b: Preview succeeded');
      assert(res13b.data.validCount === 1, '13b: Footer row not counted as a student record');
    }

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

  } finally {
    server.close();
  }

  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
