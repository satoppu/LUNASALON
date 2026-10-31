// よやクルProの「顧客情報」一覧から、新しく会員登録した方(LINE登録など)を見つける。
// 一覧の読み取り自体は scripts/autoFetchImport.js(ブラウザ操作)、ここは前回との比較と保存だけ。
//
// 会員の見分け方: 詳細ページのID(URLの ?id=…)が分かればそれを使い、分からなければ
// お名前・HN・電話・メールの組み合わせを使う。電話やメールは保存せず、有無だけ残す。
import db from "./db.js";
import { getTodayISO } from "./config.js";

/** @param {{ detailId?: string|null, name: string, hn: string, phone: string, email: string }} row */
export function customerKey(row) {
  if (row.detailId) return `id:${row.detailId}`;
  return `row:${[row.name, row.hn, row.phone, row.email].map((v) => String(v || "").trim()).join("|")}`;
}

export const hasKnownCustomers = () => Boolean(db.prepare(`SELECT 1 FROM yoyakul_customers LIMIT 1`).get());

/** 一覧のうち、まだ記録に無い会員(=前回以降に登録した方)を返す。 */
export function findNewCustomers(rows) {
  const known = db.prepare(`SELECT 1 FROM yoyakul_customers WHERE key = ?`);
  return rows.filter((r) => !known.get(customerKey(r)));
}

/** 会員を記録する(既にあるものはそのまま)。 */
export function saveCustomers(rows) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO yoyakul_customers (key, name, hn, has_phone, has_email, registered_date, first_seen_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const today = getTodayISO();
  db.exec("BEGIN");
  try {
    for (const r of rows) {
      insert.run(customerKey(r), r.name || null, r.hn || null, r.phone ? 1 : 0, r.email ? 1 : 0, r.registeredDate || null, today);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** 毎朝の通知メールに載せる文面(前後の改行は呼び出し側で付ける)。 */
export function formatNewRegistrations(result) {
  if (!result) return "";
  if (result.error) return `よやクル新規登録：取得できませんでした(${result.error})`;
  if (result.baseline) return `よやクル新規登録：今の会員${result.total}名を記録しました(明日から新規登録をお知らせします)`;
  if (result.newOnes.length === 0) return "よやクル新規登録：なし";
  const lines = result.newOnes.map((c) => {
    const label = c.name && c.name !== c.hn ? `${c.hn || c.name}(${c.name})` : c.hn || c.name;
    const contact = !c.phone && !c.email ? "・電話/メール未登録" : "";
    const date = c.registeredDate ? `・登録日 ${c.registeredDate}` : "";
    return `・${label}${date}${contact}`;
  });
  return `よやクル新規登録：${result.newOnes.length}名\n${lines.join("\n")}`;
}
