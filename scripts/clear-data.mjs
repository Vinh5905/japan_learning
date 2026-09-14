import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const confirmed = process.argv.includes("--confirm-clear");

if (!confirmed) {
  console.error(
    "Refusing to clear data. Re-run with: npm run db:clear -- --confirm-clear",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const before = await countRows();

  await pool.query("BEGIN");
  await pool.query('DELETE FROM "standalone_vocabulary_attempts"');
  await pool.query('DELETE FROM "standalone_vocabulary_items"');
  await pool.query('DELETE FROM "vocab_groups"');
  await pool.query('DELETE FROM "review_attempts"');
  await pool.query('DELETE FROM "vocabulary_items"');
  await pool.query('DELETE FROM "kanji_items"');
  await pool.query('DELETE FROM "groups"');
  await pool.query('DELETE FROM "user_column_settings"');
  await pool.query("COMMIT");

  const after = await countRows();

  console.log("Cleared database data.");
  console.log(`Before: ${JSON.stringify(before)}`);
  console.log(`After: ${JSON.stringify(after)}`);
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function countRows() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM "groups") AS groups,
      (SELECT COUNT(*)::int FROM "kanji_items") AS kanji_items,
      (SELECT COUNT(*)::int FROM "vocabulary_items") AS vocabulary_items,
      (SELECT COUNT(*)::int FROM "review_attempts") AS review_attempts,
      (SELECT COUNT(*)::int FROM "vocab_groups") AS vocab_groups,
      (SELECT COUNT(*)::int FROM "standalone_vocabulary_items") AS standalone_vocabulary_items,
      (SELECT COUNT(*)::int FROM "standalone_vocabulary_attempts") AS standalone_vocabulary_attempts,
      (SELECT COUNT(*)::int FROM "user_column_settings") AS user_column_settings
  `);

  return rows[0];
}
