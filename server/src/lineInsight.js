// LINE公式アカウントの友だち数・ターゲットリーチ・ブロック数を Messaging API の統計から取得し、
// line_stats に日ごとに記録する。毎朝の通知メールに前日の数字と増減を載せる。
//
// 必要な設定(server/.env): LINE_CHANNEL_ID / LINE_CHANNEL_SECRET(LINE Developers の
// 「チャネル基本設定」にある値)。そのたびに15分だけ使える一時的なアクセストークンを発行して
// 使うため、よやクル等が使っている既存のトークンや Webhook には一切影響しない。
import db from "./db.js";
import { getTodayISO } from "./config.js";

const shiftDate = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const isLineConfigured = () => Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);

async function issueStatelessToken() {
  const res = await fetch("https://api.line.me/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.LINE_CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`LINEのアクセストークンを発行できませんでした(${res.status})。チャネルIDとチャネルシークレットを確認してください`);
  return (await res.json()).access_token;
}

class RateLimitError extends Error {
  constructor(retryAfterSec) {
    super("LINEの統計の取得回数の上限に達しました(429)");
    this.retryAfterSec = retryAfterSec;
  }
}

async function fetchFollowers(token, dateISO) {
  const res = await fetch(`https://api.line.me/v2/bot/insight/followers?date=${dateISO.replaceAll("-", "")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) throw new RateLimitError(Number(res.headers.get("retry-after")) || null);
  if (!res.ok) throw new Error(`LINEの統計を取得できませんでした(${res.status})`);
  return res.json(); // { status: "ready" | "unready" | "out_of_service", followers, targetedReaches, blocks }
}

function saveStats(date, s) {
  db.prepare(
    `INSERT INTO line_stats (date, followers, targeted_reaches, blocks) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET followers = excluded.followers, targeted_reaches = excluded.targeted_reaches, blocks = excluded.blocks`
  ).run(date, s.followers, s.targetedReaches ?? null, s.blocks);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 過去の数字をさかのぼって取得・記録する(グラフ用。一度だけ実行すればよい)。
 * LINEの統計APIには回数制限があるため、1日分ごとに間をあけ、上限に達したら待ってから続ける
 * (続けて maxWaits 回待っても取れなければ止める)。
 * 記録済みの日は飛ばすので、途中で止まっても同じコマンドで続きから再開できる。
 */
export async function backfillLineStats(days, { intervalSec = 5, maxWaits = 40, log = console.log } = {}) {
  let token = await issueStatelessToken();
  let tokenIssuedAt = Date.now();
  const yesterday = shiftDate(getTodayISO(), -1);
  const has = db.prepare(`SELECT 1 FROM line_stats WHERE date = ?`);
  let saved = 0;
  let waits = 0;
  for (let i = 0; i < days; i++) {
    const date = shiftDate(yesterday, -i);
    if (has.get(date)) continue;
    // 一時トークンは15分で切れるため、10分ごとに発行し直す。
    if (Date.now() - tokenIssuedAt > 10 * 60 * 1000) {
      token = await issueStatelessToken();
      tokenIssuedAt = Date.now();
    }
    try {
      const s = await fetchFollowers(token, date);
      waits = 0; // 取れたら待ち回数を数え直す(上限は「続けて待った回数」)
      if (s.status === "ready") {
        saveStats(date, s);
        saved++;
        log(`${date}: 友だち ${s.followers}・ブロック ${s.blocks}`);
      } else {
        log(`${date}: 集計なし(${s.status})`);
      }
    } catch (err) {
      if (!(err instanceof RateLimitError) || ++waits > maxWaits) throw Object.assign(err, { saved });
      const waitSec = err.retryAfterSec ?? 60;
      log(`回数の上限のため ${waitSec}秒待ちます…`);
      await sleep(waitSec * 1000);
      i--; // 同じ日をやり直す
      continue;
    }
    await sleep(intervalSec * 1000);
  }
  return saved;
}

/** ダッシュボードのグラフ用に、記録した全期間の数字を日付順で返す。 */
export function listLineStats() {
  return db.prepare(`SELECT date, followers, targeted_reaches AS targetedReaches, blocks FROM line_stats ORDER BY date`).all();
}

/**
 * 前日(集計が間に合っていなければその前日)の数字を取得・記録し、通知メール用の1行を返す。
 * 未設定なら空文字。
 */
export async function updateLineStats() {
  if (!isLineConfigured()) return "";
  const token = await issueStatelessToken();
  const yesterday = shiftDate(getTodayISO(), -1);
  for (const date of [yesterday, shiftDate(yesterday, -1)]) {
    const s = await fetchFollowers(token, date);
    if (s.status !== "ready") continue;
    saveStats(date, s);
    return formatLineStats(date);
  }
  return "\n\nLINE：まだ集計されていません";
}

/** 指定日の数字と、記録がある前日との差を1行にする。 */
export function formatLineStats(date) {
  const cur = db.prepare(`SELECT * FROM line_stats WHERE date = ?`).get(date);
  if (!cur) return "";
  const prev = db.prepare(`SELECT * FROM line_stats WHERE date < ? ORDER BY date DESC LIMIT 1`).get(date);
  const diff = (key) => {
    if (!prev || cur[key] == null || prev[key] == null) return "";
    const d = cur[key] - prev[key];
    return `（${d >= 0 ? "+" : ""}${d}）`;
  };
  const md = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return (
    `\n\nLINE（${md}時点）：友だち ${cur.followers}${diff("followers")}` +
    `・ターゲットリーチ ${cur.targeted_reaches ?? "—"}${diff("targeted_reaches")}` +
    `・ブロック ${cur.blocks}${diff("blocks")}`
  );
}
