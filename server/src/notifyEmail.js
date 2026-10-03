// server/scripts/autoFetchImport.js の実行結果をメールで通知するための小さな
// ヘルパー。Gmail のSMTP(アプリパスワード)経由で送信する。
// GMAIL_USER / GMAIL_APP_PASSWORD / NOTIFY_EMAIL_TO が server/.env に
// 揃っていない場合は何もしない(自動取り込み自体は通知なしで継続する)。
import nodemailer from "nodemailer";

export async function sendResultEmail({ subject, text }) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL_TO } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !NOTIFY_EMAIL_TO) {
    console.log("メール通知はスキップされました(GMAIL_USER / GMAIL_APP_PASSWORD / NOTIFY_EMAIL_TO が未設定)。");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  await transporter.sendMail({
    from: GMAIL_USER,
    to: NOTIFY_EMAIL_TO,
    subject,
    text,
  });
}
