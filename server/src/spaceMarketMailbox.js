// luna@mj-japan.net の受信トレイ(IMAP)からスペースマーケットの通知メールを
// 読み、spaceMarketEmail.js で反映する。受信トレイは読み取り専用で開くため、
// 既読/未読などメールの状態は一切変えない。
//
// 必要な設定(server/.env): SPACEMARKET_IMAP_HOST / SPACEMARKET_IMAP_USER /
// SPACEMARKET_IMAP_PASSWORD(任意で SPACEMARKET_IMAP_PORT、既定993)。
// 未設定なら何もしない。
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { applySpaceMarketEmail, parseSpaceMarketEmail, promotePastManualPendingRows } from "./spaceMarketEmail.js";

const LOOKBACK_DAYS = 14;

export function isSpaceMarketMailboxConfigured() {
  const { SPACEMARKET_IMAP_HOST, SPACEMARKET_IMAP_USER, SPACEMARKET_IMAP_PASSWORD } = process.env;
  return Boolean(SPACEMARKET_IMAP_HOST && SPACEMARKET_IMAP_USER && SPACEMARKET_IMAP_PASSWORD);
}

// dryRun: DBは変えず、各メールの読み取り結果だけを返す(初回の動作確認用)。
/** @returns {Promise<{ lines: string[], problems: string[] } | null>} 未設定なら null */
export async function importSpaceMarketEmails({ lookbackDays = LOOKBACK_DAYS, dryRun = false } = {}) {
  if (!isSpaceMarketMailboxConfigured()) return null;
  const client = new ImapFlow({
    host: process.env.SPACEMARKET_IMAP_HOST,
    port: Number(process.env.SPACEMARKET_IMAP_PORT) || 993,
    secure: true,
    auth: { user: process.env.SPACEMARKET_IMAP_USER, pass: process.env.SPACEMARKET_IMAP_PASSWORD },
    logger: false,
  });

  const lines = [];
  const problems = [];
  await client.connect();
  try {
    await client.mailboxOpen("INBOX", { readOnly: true });
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const uids = (await client.search({ from: "spacemarket.com", since }, { uid: true })) || [];
    const messages = [];
    for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      messages.push({
        messageId: parsed.messageId || `uid-${msg.uid}`,
        subject: parsed.subject || "",
        text: parsed.text || "",
        date: parsed.date || null,
      });
    }
    // 予約→変更→キャンセルの順に反映されるよう、受信日時の古い順に処理する。
    messages.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    for (const m of messages) {
      if (dryRun) {
        const e = parseSpaceMarketEmail(m);
        lines.push(`${m.date?.toISOString().slice(0, 10)} ${m.subject}\n  → ${JSON.stringify(e)}`);
        continue;
      }
      const r = applySpaceMarketEmail(m);
      if (r.skipped) continue;
      (r.ok ? lines : problems).push(r.summary);
    }
  } finally {
    await client.logout().catch(() => {});
  }

  if (dryRun) return { lines, problems };
  const promoted = promotePastManualPendingRows();
  if (promoted > 0) lines.push(`利用日を過ぎた${promoted}件を「利用前」→「利用済み」に更新`);
  return { lines, problems };
}

/** 毎朝の結果メールに添える文面。未設定なら空文字。 */
export function formatSpaceMarketSection(result, error) {
  if (error) return `\n\n----------------\n\nスペースマーケットのメール取り込みに失敗しました。\n${error.message}`;
  if (!result) return "";
  const body = [
    ...(result.lines.length ? result.lines : ["新しいメールはありませんでした"]),
    ...(result.problems.length ? ["", "【要確認】", ...result.problems] : []),
  ].join("\n");
  return `\n\n----------------\n\nスペースマーケット(メール取り込み)\n\n${body}`;
}
