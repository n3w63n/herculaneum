import test from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { chaptersFromDb } from "../src/lib/chapters.js";

async function makeDb(path, value) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE offline_tbl (offline_path TEXT, offline_value TEXT)");
  db.run("INSERT INTO offline_tbl VALUES (?, ?)", [path, value]);
  return db.export();
}

const DB_PATH = "meyoung/publication/vol-1";

test("chaptersFromDb reads and filters the chapter list", async () => {
  const value = JSON.stringify({
    indexContents: {
      chapters: [{ chapterId: "ch-1" }, { title: "no id" }, { chapterId: "ch-2" }],
    },
  });
  const bytes = await makeDb(DB_PATH, value);
  const chapters = await chaptersFromDb(bytes, DB_PATH);
  assert.deepEqual(
    chapters.map((c) => c.chapterId),
    ["ch-1", "ch-2"]
  );
});

test("chaptersFromDb throws when the book path is missing", async () => {
  const bytes = await makeDb("some/other/path", "{}");
  await assert.rejects(() => chaptersFromDb(bytes, DB_PATH), /not found in DB/);
});

test("chaptersFromDb throws on corrupt chapter JSON", async () => {
  const bytes = await makeDb(DB_PATH, "not json");
  await assert.rejects(() => chaptersFromDb(bytes, DB_PATH), /chapter list/);
});
