// 予約サイトの通知メールを IMAP で読み、それぞれの解析・反映モジュールに渡す。
// 受信トレイは読み取り専用で開くため、既読/未読などメールの状態は一切変えない。
//
// 必要な設定(server/.env)。設定されていない取り込み元は何もしない。
//   スペースマーケット(luna@mj-japan.net): SPACEMARKET_IMAP_HOST / _USER / _PASSWORD
//   インスタベース(info@lunasalon.jp):     INSTABASE_IMAP_HOST / _USER / _PASSWORD
//   (任意で *_IMAP_PORT、既定993)
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import db from "./db.js";
import { getTodayISO, PENDING_STATUS } from "./config.js";
import { processEmailOnce, markEmailBaseline } from "./emailImportLog.js";
import { parseSpaceMarketEmail, applySpaceMarketEmail } from "./spaceMarketEmail.js";
import { parseInstabaseEmail, applyInstabaseEmail } from "./instabaseEmail.js";

const LOOKBACK_DAYS = 14;

export const EMAIL_SOURCES = [
  { key: "spacemarket", label: "スペースマーケット", env: "SPACEMARKET_IMAP", from: "spacemarket.com", parse: parseSpaceMarketEmail, apply: applySpaceMarketEmail },
  { key: "instabase", label: "インスタベース", env: "INSTABASE_IMAP", from: "instabase.jp", parse: parseInstabaseEmail, apply: applyInstabaseEmail },
];

function configFor(source) {
  const host = process.env[`${source.env}_HOST`];
  const user = process.env[`${source.env}_USER`];
  const pass = process.env[`${source.env}_PASSWORD`];
  if (!host || !user || !pass) return null;
  return { host, user, pass, port: Number(process.env[`${source.env}_PORT`]) || 993 };
}

export const configuredSources = () => EMAIL_SOURCES.filter((s) => configFor(s));

async function fetchMessages(source, lookbackDays) {
  const cfg = configFor(source);
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false });
  const messages = [];
  await client.connect();
  try {
    await client.mailboxOpen("INBOX", { readOnly: true });
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const uids = (await client.search({ from: source.from, since }, { uid: true })) || [];
    for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      messages.push({
        messageId: parsed.messageId || `${source.key}-uid-${msg.uid}`,
        subject: parsed.subject || "",
        text: parsed.text || "",
        date: parsed.date || null,
      });
    }
  } finally {
    await client.logout().catch(() => {});
  }
  // 予約→変更→キャンセルの順に反映されるよう、受信日時の古い順に処理する。
  return messages.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
}

/**
 * 1つの取り込み元のメールを処理する。
 * dryRun: DBは変えず、各メールの読み取り結果だけを返す(初回の動作確認用)。
 * baseline: 反映せず「処理済み」の印だけ付ける(導入時に一度だけ。手入力・CSV取り込み済みの過去分との二重登録を防ぐ)。
 */
async function importFromSource(source, { lookbackDays, dryRun, baseline }) {
  const lines = [];
  const problems = [];
  for (const m of await fetchMessages(source, lookbackDays)) {
    if (dryRun) {
      const e = source.parse(m);
      if (e.kind !== "ignored") lines.push(`${m.date?.toISOString().slice(0, 10)} ${m.subject}\n  → ${JSON.stringify(e)}`);
      continue;
    }
    if (baseline) {
      if (markEmailBaseline(source.key, m, source.parse)) lines.push(`印のみ: ${m.subject}`);
      continue;
    }
    const r = processEmailOnce(source.key, m, source.parse, source.apply);
    if (r.skipped || r.silent) continue;
    (r.ok ? lines : problems).push(r.summary);
  }
  return { lines, problems };
}

/**
 * 利用日を過ぎた「利用前」の行を「利用済み」にする。対象は、毎日のCSV取り込みで更新されない行
 * (手入力・メール取り込みのスペースマーケットと、メール取り込みのインスタベース)。
 */
export function promotePastPendingRows() {
  return db
    .prepare(`UPDATE transactions SET status = '利用済み' WHERE status = ? AND date < ? AND (manual_entry = 1 OR channel = 'Instabase')`)
    .run(PENDING_STATUS, getTodayISO()).changes;
}

/**
 * 設定済みの取り込み元すべてを処理する。1つが失敗しても他は続ける。
 * @returns {Promise<Array<{ source: object, result?: { lines: string[], problems: string[] }, error?: Error }>>}
 */
export async function importPlatformEmails({ lookbackDays = LOOKBACK_DAYS, dryRun = false, baseline = false, only } = {}) {
  const outcomes = [];
  for (const source of configuredSources().filter((s) => !only || s.key === only)) {
    try {
      outcomes.push({ source, result: await importFromSource(source, { lookbackDays, dryRun, baseline }) });
    } catch (error) {
      outcomes.push({ source, error });
    }
  }
  if (!dryRun && !baseline && outcomes.length > 0) {
    const promoted = promotePastPendingRows();
    if (promoted > 0) outcomes.push({ source: { label: "共通" }, result: { lines: [`利用日を過ぎた${promoted}件を「利用前」→「利用済み」に更新`], problems: [] } });
  }
  return outcomes;
}

/** 毎朝の結果メールに添える文面。取り込み元が1つも設定されていなければ空文字。 */
export function formatEmailImportSection(outcomes) {
  return outcomes
    .map(({ source, result, error }) => {
      if (error) return `\n\n----------------\n\n${source.label}のメール取り込みに失敗しました。\n${error.message}`;
      const body = [
        ...(result.lines.length ? result.lines : ["新しいメールはありませんでした"]),
        ...(result.problems.length ? ["", "【要確認】", ...result.problems] : []),
      ].join("\n");
      return `\n\n----------------\n\n${source.label}(メール取り込み)\n\n${body}`;
    })
    .join("");
}
