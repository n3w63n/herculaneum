// Chapter index reader: publication.db is a SQLite file inside publication.zip.
// sql.js (WASM) replaces better-sqlite3; locateFile is provided by the caller
// (extension passes chrome.runtime.getURL, node uses sql.js's default).
import initSqlJs from "sql.js";

export async function chaptersFromDb(dbBytes, dbPath, sqlOptions = {}) {
  const SQL = await initSqlJs(sqlOptions);
  const db = new SQL.Database(dbBytes);
  try {
    const rows = db.exec("SELECT offline_value FROM offline_tbl WHERE offline_path = ?", [
      dbPath,
    ]);
    if (!rows.length || !rows[0].values.length) {
      throw new Error(`Book not found in DB for path: ${dbPath}`);
    }
    let chapters;
    try {
      chapters = JSON.parse(rows[0].values[0][0]).indexContents?.chapters || [];
    } catch (err) {
      throw new Error(`Cannot read chapter list: ${err.message}`);
    }
    return chapters.filter((chapter) => chapter?.chapterId);
  } finally {
    db.close();
  }
}
