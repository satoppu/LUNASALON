// 自動取り込みで失敗したファイル(scripts/debug-shots/failed-*)の中身の
// 形(CSVごとの列名・行数・1行目の値)をメールで送る診断用スクリプト。
// サーバーの端末では日本語が文字化けするため、メールで読めるようにする。
//
// Usage: node scripts/inspectFailedImport.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import Papa from "papaparse";
import { sendResultEmail } from "../src/notifyEmail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const DEBUG_DIR = path.join(__dirname, "debug-shots");
const files = fs.existsSync(DEBUG_DIR) ? fs.readdirSync(DEBUG_DIR).filter((f) => f.startsWith("failed-")).sort() : [];
if (files.length === 0) {
  console.log("debug-shots/ に failed-* のファイルがありません。");
  process.exit(0);
}
const latest = files[files.length - 1];
const buffer = fs.readFileSync(path.join(DEBUG_DIR, latest));

function describeCsv(name, buf) {
  const text = buf.toString("utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const fields = parsed.meta.fields || [];
  const first = parsed.data[0] || {};
  return [
    `■ ${name}`,
    `データ行数: ${parsed.data.length}`,
    `文字化け(U+FFFD)の有無: ${text.includes("�") ? "あり(UTF-8ではない可能性)" : "なし"}`,
    `列(${fields.length}個):`,
    ...fields.map((f, i) => `  ${i + 1}. ${f} = ${String(first[f] ?? "").slice(0, 40)}`),
  ].join("\n");
}

const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
const sections = isZip
  ? new AdmZip(buffer)
      .getEntries()
      .filter((e) => !e.isDirectory)
      .map((e) => describeCsv(e.entryName, e.getData()))
  : [describeCsv(latest, buffer)];

const text = [`ファイル: ${latest}`, `種類: ${isZip ? "zip" : "CSV単体"}`, ...sections].join("\n\n");
console.log(text);
await sendResultEmail({ subject: "【LUNA】失敗ファイルの診断", text });
console.log("診断結果をメールで送信しました。");
