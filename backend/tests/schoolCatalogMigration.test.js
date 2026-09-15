const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// Explicit opt-in only. All SQL runs against TEMP tables in a rolled-back
// transaction, and hosted connection URLs are refused before any connection.
test('catalog migration persists configured schools and preserves existing classifications and IDs', {
  skip: process.env.PGCEAP_TEST_CATALOG_MIGRATION !== '1',
}, async () => {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only a local PostgreSQL database is allowed');
  const { Client } = require('pg');
  const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 2000 });
  const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260915000000_persist_school_catalog/migration.sql'), 'utf8')
    .replace(/^(BEGIN|COMMIT);\r?$/gm, '');
  const configured = require('../../schools_list.json').schools;
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TEMP TABLE schools (
      id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE, school_type VARCHAR(20) NOT NULL DEFAULT 'public',
      is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    ) ON COMMIT DROP`);
    const shadow = await client.query("SELECT relnamespace = pg_my_temp_schema() AS isolated FROM pg_class WHERE oid = 'schools'::regclass");
    assert.equal(shadow.rows[0].isolated, true, 'Refuse to test against a persistent school table');
    await client.query(`INSERT INTO schools (name, school_type) VALUES
      ($1, 'unclassified'), ($2, 'private'), ($3, 'private'), ($4, 'public')`, [
      'University of Camarines Norte, Main Campus',
      configured.find((name) => name.includes('Aba')),
      'Mabini Colleges, Inc.',
      '  university of camarines norte,   mercedes campus ',
    ]);
    await client.query(migration);
    const first = (await client.query('SELECT id, name, school_type FROM schools ORDER BY id')).rows;
    assert.equal(first.length, configured.length);
    assert.equal(first[0].id, 1);
    assert.equal(first[0].school_type, 'public');
    assert.equal(first[1].school_type, 'private', 'Do not overwrite an explicitly saved UCN classification');
    assert.equal(first[2].school_type, 'private');
    assert.equal(first[3].id, 4, 'Normalized names reuse existing IDs');
    assert.equal(first.filter((row) => row.school_type === 'unclassified').length, 17);
    await client.query('DROP TABLE pgceap_catalog_defaults');
    await client.query(migration);
    assert.deepEqual((await client.query('SELECT id, name, school_type FROM schools ORDER BY id')).rows, first);
    const defaultRow = await client.query("INSERT INTO schools (name) VALUES ('TEST UNCLASSIFIED SCHOOL') RETURNING school_type");
    assert.equal(defaultRow.rows[0].school_type, 'unclassified');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
