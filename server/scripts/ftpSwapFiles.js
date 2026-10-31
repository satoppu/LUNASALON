// ホームページ(lunasalon.jp、お名前.comのレンタルサーバー)のファイルを、指定日時に
// FTPでリネームして入れ替える。VPSのcronから実行する(夜中に人が作業しなくて済むように)。
//
// 新しいファイル(例: asteria1101.html)は前もってサーバーに置いておき、当日に
//   1. 今のファイル(asteria.html)を asteria.html.bak-YYYYMMDD に改名してバックアップ
//   2. 新しいファイルを asteria.html に改名
//   3. 改名後の大きさが元の新しいファイルと同じか確認
// を行う。2で失敗したら1を元に戻す。結果は logs/ftp-swap-<日付>.json に保存し、
// --report で(別の時刻に)メールで知らせる。
//
// 必要な設定(server/.env): FTP_HOST / FTP_USER / FTP_PASSWORD / FTP_DIR(ファイルのあるフォルダ)
//   任意で FTP_PORT(既定21)、FTP_SECURE=false(FTPS(暗号化)を使わない場合)
//
// Usage:
//   node scripts/ftpSwapFiles.js --check  --swap 新:今 [--swap 新:今 ...]   # 接続とファイルの有無を確認(何も変えない)
//   node scripts/ftpSwapFiles.js --run    --date 2026-11-01 --swap 新:今 ... # 入れ替え(当日以外は何もしない)
//   node scripts/ftpSwapFiles.js --report --date 2026-11-01                 # 結果をメールで送る(当日以外は何もしない)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "basic-ftp";
import { sendResultEmail } from "../src/notifyEmail.js";
import { getTodayISO } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const LOG_DIR = path.join(__dirname, "..", "logs");
const RETRY_DELAY_MS = 5 * 60 * 1000;

const args = process.argv.slice(2);
const mode = ["--check", "--run", "--report"].find((m) => args.includes(m));
const argValue = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const date = argValue("--date");
const swaps = args
  .flatMap((a, i) => (a === "--swap" ? [args[i + 1]] : []))
  .map((s) => {
    const [from, to] = String(s).split(":");
    return { from, to };
  });

if (!mode) {
  console.error("--check / --run / --report のどれかを指定してください。");
  process.exit(1);
}
if ((mode === "--check" || mode === "--run") && (swaps.length === 0 || swaps.some((s) => !s.from || !s.to))) {
  console.error("--swap 新しいファイル名:入れ替え先のファイル名 を指定してください。");
  process.exit(1);
}
if (mode !== "--check" && !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
  console.error("--date YYYY-MM-DD を指定してください。");
  process.exit(1);
}
// cronの「11月1日」は毎年来るため、指定した日以外は何もしない。
if (mode !== "--check" && getTodayISO() !== date) {
  console.log(`今日(${getTodayISO()})は実行日(${date})ではないため、何もしません。`);
  process.exit(0);
}

const resultPath = path.join(LOG_DIR, `ftp-swap-${date}.json`);

async function connect() {
  const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD, FTP_DIR, FTP_SECURE } = process.env;
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) throw new Error("server/.env に FTP_HOST / FTP_USER / FTP_PASSWORD を設定してください。");
  const client = new Client(30000);
  await client.access({ host: FTP_HOST, port: Number(FTP_PORT) || 21, user: FTP_USER, password: FTP_PASSWORD, secure: FTP_SECURE !== "false" });
  if (FTP_DIR) await client.cd(FTP_DIR);
  return client;
}

async function sizes(client) {
  const list = await client.list();
  return new Map(list.filter((f) => f.isFile).map((f) => [f.name, f.size]));
}

async function check() {
  const client = await connect();
  try {
    const files = await sizes(client);
    console.log(`接続OK。フォルダ: ${await client.pwd()}`);
    for (const { from, to } of swaps) {
      console.log(`${from}: ${files.has(from) ? `あり(${files.get(from)}バイト)` : "★見つかりません"}`);
      console.log(`${to}: ${files.has(to) ? `あり(${files.get(to)}バイト)` : "★見つかりません"}`);
    }
    if (swaps.some(({ from }) => !files.has(from))) {
      console.log("\nフォルダ内のファイル:\n" + [...files.keys()].join("\n"));
    }
  } finally {
    client.close();
  }
}

async function swapOnce(client, { from, to }) {
  const files = await sizes(client);
  const dayBackup = `${to}.bak-${date.replaceAll("-", "")}`;
  if (!files.has(from) && files.has(to) && files.has(dayBackup)) {
    // やり直しの回で、前の回にすでに入れ替えが終わっていた場合。
    return { from, to, ok: true, backup: dayBackup, message: `${from} → ${to} は入れ替え済みです。旧ファイルは ${dayBackup} に保存` };
  }
  if (!files.has(from)) return { from, to, ok: false, message: `${from} が見つかりませんでした(入れ替えていません)` };
  const expectedSize = files.get(from);

  let backup = null;
  if (files.has(to)) {
    backup = files.has(dayBackup) ? `${dayBackup}-${Date.now()}` : dayBackup;
    await client.rename(to, backup);
  }
  try {
    await client.rename(from, to);
  } catch (err) {
    if (backup) await client.rename(backup, to).catch(() => {});
    return { from, to, ok: false, message: `${from} → ${to} の改名に失敗したため元に戻しました: ${err.message}` };
  }
  const after = await sizes(client);
  const ok = after.get(to) === expectedSize;
  return {
    from,
    to,
    ok,
    backup,
    message: ok
      ? `${from} → ${to} に入れ替えました(${expectedSize}バイト)${backup ? `。旧ファイルは ${backup} に保存` : ""}`
      : `${to} の大きさが想定(${expectedSize}バイト)と違います(${after.get(to) ?? "なし"})。確認してください`,
  };
}

async function run() {
  if (fs.existsSync(resultPath)) {
    console.log(`${resultPath} があるため、すでに実行済みです。何もしません。`);
    return;
  }
  let results;
  for (let attempt = 1; ; attempt++) {
    let client;
    try {
      client = await connect();
      results = [];
      for (const swap of swaps) results.push(await swapOnce(client, swap));
      break;
    } catch (err) {
      // 接続できない等。1回だけ待ってやり直す(前の回で入れ替え済みのものは「入れ替え済み」として扱う)。
      if (attempt >= 2) {
        results = [{ ok: false, message: `FTPでの作業に失敗しました: ${err.message}` }];
        break;
      }
      console.error(new Date().toISOString(), `失敗(${attempt}回目)。5分後にやり直します:`, err.message);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } finally {
      client?.close();
    }
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(resultPath, JSON.stringify({ ranAt: new Date().toISOString(), results, reported: false }, null, 1));
  console.log(new Date().toISOString(), JSON.stringify(results));
}

async function report() {
  if (!fs.existsSync(resultPath)) {
    await sendResultEmail({
      subject: "【LUNA】ホームページのファイル入れ替え：未実行",
      text: `${date} のファイル入れ替えが実行された記録がありません。\nVPSのcronの設定と、お名前.comのファイル管理で現在のファイルを確認してください。`,
    });
    return;
  }
  const saved = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  if (saved.reported) {
    console.log("結果はすでにメールで送っています。");
    return;
  }
  const allOk = saved.results.every((r) => r.ok);
  await sendResultEmail({
    subject: `【LUNA】ホームページのファイル入れ替え：${allOk ? "完了" : "要確認"}`,
    text:
      `${date} のファイル入れ替えの結果です(実行: ${new Date(saved.ranAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })})。\n\n` +
      saved.results.map((r) => `${r.ok ? "✅" : "⚠️"} ${r.message}`).join("\n") +
      (allOk ? "\n\nホームページで表示を確認してください。" : "\n\nお名前.comのファイル管理で、現在のファイルを確認してください。"),
  });
  fs.writeFileSync(resultPath, JSON.stringify({ ...saved, reported: true }, null, 1));
  console.log("結果をメールで送りました。");
}

try {
  if (mode === "--check") await check();
  else if (mode === "--run") await run();
  else await report();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
