// Standalone raw driver: no application imports, auto-indexing, scheduler or seeds.
// audit is read-only; apply requires an explicitly reviewed plan and writes a backup first.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const [mode = 'audit', reportFile, planFile] = process.argv.slice(2);
if (!['audit', 'apply', 'rollback'].includes(mode) || !reportFile || (mode !== 'audit' && !planFile)) {
  throw new Error('Usage: node scripts/storage-paths.mjs audit report.json | apply backup.json plan.json | rollback result.json backup.json');
}
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI privately; use a read-only account for audit');
const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI);
const allowed = {
  documents: ['file_path'], aiextractions: ['ocr_text_path'],
  complaints: ['evidence', 'proof_document'], yearlyreports: ['evidence'], institutionannualreports: ['evidence'],
};
const absolute = value => path.win32.isAbsolute(value) || path.posix.isAbsolute(value);
const safeRelative = value => typeof value === 'string' && value.length > 0 && !absolute(value)
  && !value.includes('\\') && !value.split('/').some(p => ['', '.', '..'].includes(p));
const readAt = (obj, field) => field.split('.').reduce((v, key) => v?.[key], obj);
const validField = (collection, field) => (allowed[collection] || []).includes(field)
  || ['complaints', 'yearlyreports', 'institutionannualreports'].includes(collection) && /^evidence\.\d+\.storage_path$/.test(field)
  || collection === 'complaints' && field === 'proof_document.storage_path';
const save = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 });
try {
  await client.connect();
  const db = client.db();
  if (db.databaseName !== 'approvaltrack' && !db.databaseName.startsWith('approvaltrack_migration_test_')) throw new Error('Unexpected database');
  if (mode === 'audit') {
    const rows = [];
    for (const [collection, fields] of Object.entries(allowed)) {
      for await (const doc of db.collection(collection).find({}, { projection: { ...Object.fromEntries(fields.map(f => [f, 1])), sha256: 1 } })) {
        const entries = [];
        for (const field of fields) {
          if (field === 'evidence') (doc.evidence || []).forEach((e, i) => entries.push([`evidence.${i}.storage_path`, e.storage_path, e.sha256]));
          else if (field === 'proof_document') entries.push(['proof_document.storage_path', doc.proof_document?.storage_path, doc.proof_document?.sha256]);
          else entries.push([field, doc[field], field === 'file_path' ? doc.sha256 : null]);
        }
        for (const [field, value, expectedSha256] of entries) {
          if (!value) continue;
          const row = { collection, id: String(doc._id), field, before: value, absolute: absolute(value), safeRelative: safeRelative(value) };
          if (process.env.UPLOAD_DIR && row.safeRelative) {
            try {
              const bytes = await fs.readFile(path.join(process.env.UPLOAD_DIR, value));
              row.exists = true;
              row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
              if (expectedSha256) row.hashMatches = row.sha256 === expectedSha256;
            } catch { row.exists = false; }
          }
          rows.push(row);
        }
      }
    }
    await save(reportFile, { database: db.databaseName, createdAt: new Date(), rows });
    console.log(`Audit saved: ${rows.length} paths; ${rows.filter(r => r.absolute).length} absolute; ${rows.filter(r => r.exists === false).length} missing`);
  } else {
    const input = JSON.parse(await fs.readFile(planFile, 'utf8'));
    if (input.database !== db.databaseName || !Array.isArray(input.rows)) throw new Error('Invalid plan database/rows');
    const changes = input.rows.map(r => mode === 'rollback' ? { ...r, before: r.after, after: r.before } : r);
    const seen = new Set();
    for (const r of changes) {
      const key = `${r.collection}/${r.id}/${r.field}`;
      if (seen.has(key)) throw new Error('Duplicate change');
      seen.add(key);
      if (!validField(r.collection, r.field) || typeof r.before !== 'string' || typeof r.after !== 'string' || mode === 'apply' && !safeRelative(r.after)) throw new Error('Invalid path change');
      const current = await db.collection(r.collection).findOne({ _id: new mongoose.mongo.ObjectId(r.id) });
      if (readAt(current, r.field) !== r.before) throw new Error('Record changed; regenerate plan');
      if (mode === 'apply') {
        if (!process.env.UPLOAD_DIR) throw new Error('UPLOAD_DIR required');
        const bytes = await fs.readFile(path.join(process.env.UPLOAD_DIR, r.after));
        if (!r.sha256 || crypto.createHash('sha256').update(bytes).digest('hex') !== r.sha256) throw new Error('Missing or mismatched target SHA256');
      }
    }
    // Exclusive backup creation must succeed before any database write.
    await save(reportFile, { database: db.databaseName, createdAt: new Date(), rows: changes });
    for (const r of changes) {
      const result = await db.collection(r.collection).updateOne({ _id: new mongoose.mongo.ObjectId(r.id), [r.field]: r.before }, { $set: { [r.field]: r.after } });
      if (result.modifiedCount !== 1) throw new Error('Concurrent update; stop and reconcile using backup');
    }
    console.log(`Updated ${changes.length} paths; backup saved before writes`);
  }
} finally { await client.close(); }
