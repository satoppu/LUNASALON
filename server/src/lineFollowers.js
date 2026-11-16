// LINE公式アカウントの友だちを毎朝記録し、前回いた人がいなくなっていたら「ブロック」として
// 名前(LINEの表示名)を知らせる。友だち追加した人も知らせる。
//
// Messaging API の「友だちのユーザーID一覧」(認証済み・プレミアムアカウントのみ)と
// 「プロフィール取得」を使う。ブロックした人のプロフィールは取れなくなるため、友だちのうちに
// 表示名を line_followers に記録しておき、その名前で知らせる。
// 初回は今の友だちを記録するだけで、知らせるのは翌日から。
// 一覧から消える理由はブロックのほか、LINEアカウントの削除もある(見分けはつかない)。
import db from "./db.js";
import { getTodayISO } from "./config.js";
import { isLineConfigured, issueStatelessToken } from "./lineInsight.js";

const API = "https://api.line.me/v2/bot";

async function getJson(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 403) {
    throw new Error("友だちの一覧を取得できませんでした(403)。認証済みアカウントでないと使えない機能です");
  }
  if (!res.ok) throw new Error(`LINEの友だち情報を取得できませんでした(${res.status})`);
  return res.json();
}

async function fetchFollowerIds(token) {
  const ids = [];
  let start;
  do {
    const url = `${API}/followers/ids?limit=1000${start ? `&start=${encodeURIComponent(start)}` : ""}`;
    const page = await getJson(token, url);
    ids.push(...page.userIds);
    start = page.next;
  } while (start);
  return ids;
}

async function fetchDisplayName(token, userId) {
  try {
    return (await getJson(token, `${API}/profile/${userId}`)).displayName ?? null;
  } catch {
    return null; // 取れなくても一覧の記録は続ける
  }
}

/**
 * 友だち一覧を記録し、前回からの変化を返す。
 * @returns {Promise<{ baseline: boolean, total: number, added: string[], left: string[] }>}
 */
export async function syncLineFollowers() {
  const token = await issueStatelessToken();
  const ids = await fetchFollowerIds(token);
  const today = getTodayISO();
  const known = new Map(db.prepare(`SELECT user_id, display_name, left_date FROM line_followers`).all().map((r) => [r.user_id, r]));
  const baseline = known.size === 0;
  const current = new Set(ids);

  const added = [];
  const toInsert = [];
  for (const id of ids) {
    const row = known.get(id);
    if (row && !row.left_date) continue;
    // 新しい友だち、またはブロックを解除して戻ってきた人。表示名を取り直す。
    const name = (await fetchDisplayName(token, id)) ?? row?.display_name ?? null;
    toInsert.push([id, name]);
    if (!baseline) added.push(name ?? "(名前不明)");
  }
  const left = [...known.values()].filter((r) => !r.left_date && !current.has(r.user_id));

  const upsert = db.prepare(
    `INSERT INTO line_followers (user_id, display_name, first_seen, last_seen, left_date) VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(user_id) DO UPDATE SET display_name = COALESCE(excluded.display_name, display_name), last_seen = excluded.last_seen, left_date = NULL`
  );
  db.exec("BEGIN");
  try {
    for (const [id, name] of toInsert) upsert.run(id, name, today, today);
    db.prepare(`UPDATE line_followers SET last_seen = ? WHERE left_date IS NULL`).run(today);
    const markLeft = db.prepare(`UPDATE line_followers SET left_date = ? WHERE user_id = ?`);
    for (const r of left) markLeft.run(today, r.user_id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { baseline, total: ids.length, added, left: left.map((r) => r.display_name ?? "(名前不明)") };
}

/** 毎朝のメール用の文面。未設定なら空文字。 */
export async function updateLineFollowers() {
  if (!isLineConfigured()) return "";
  const r = await syncLineFollowers();
  if (r.baseline) return `\nLINEの友だち${r.total}人を記録しました(明日からブロック・友だち追加した方の名前をお知らせします)`;
  const names = (list) => (list.length ? list.join("、") : "なし");
  return `\nLINEブロック：${names(r.left)}\nLINE友だち追加：${names(r.added)}`;
}
