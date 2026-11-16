// LINEでブロックした方(と友だち追加した方)の履歴を出す。いつ・誰が(LINEの表示名)。
// 記録は 2026/11/16 から(毎朝の自動取り込みで lineFollowers.js が記録している)。
// ターミナルでは日本語が文字化けすることがあるため、--email を付けるとメールで送る(CSV添付)。
// Usage:
//   node scripts/lineBlockList.js           # ブロックだけ
//   node scripts/lineBlockList.js --all     # 友だち追加も含める
//   node scripts/lineBlockList.js --email
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { listLineFollowerEvents } = await import("../src/lineFollowers.js");

const all = process.argv.includes("--all");
const rows = listLineFollowerEvents({ event: all ? undefined : "block" });
const label = { block: "ブロック", follow: "友だち追加" };
const md = (iso) => `${iso.slice(0, 4)}/${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

const text = [
  `LINEの${all ? "ブロック・友だち追加" : "ブロック"}の履歴です(新しい順・${rows.length}件)。`,
  "日付は気づいた日(毎朝の取り込みの日)で、実際にはその前日のことが多いです。名前はLINEの表示名です。",
  "",
  ...(rows.length ? rows.map((r) => `${md(r.date)} ${label[r.event]} ${r.name ?? "(名前不明)"}`) : ["まだありません"]),
].join("\n");

if (process.argv.includes("--email")) {
  const { sendResultEmail } = await import("../src/notifyEmail.js");
  const csv = "﻿" + [["日付", "内容", "LINEの表示名"], ...rows.map((r) => [r.date, label[r.event], r.name ?? ""])]
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  await sendResultEmail({
    subject: "【LUNA】LINEブロックの履歴",
    text,
    attachments: [{ filename: "line-blocks.csv", content: csv, contentType: "text/csv; charset=utf-8" }],
  });
  console.log("メールで送りました。");
} else {
  console.log(text);
}
