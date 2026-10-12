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

async function fetchFollowers(token, dateISO) {
  const res = await fetch(`https://api.line.me/v2/bot/insight/followers?date=${dateISO.replaceAll("-", "")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`LINEの統計を取得できませんでした(${res.status})`);
  return res.json(); // { status: "ready" | "unready" | "out_of_service", followers, targetedReaches, blocks }
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
    db.prepare(
      `INSERT INTO line_stats (date, followers, targeted_reaches, blocks) VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET followers = excluded.followers, targeted_reaches = excluded.targeted_reaches, blocks = excluded.blocks`
    ).run(date, s.followers, s.targetedReaches ?? null, s.blocks);
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
