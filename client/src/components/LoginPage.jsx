import { useState } from "react";
import { api } from "../api.js";
import { FONT_HEAD, FONT_BODY } from "../constants.js";

export default function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(username, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ background: "#FCF8F0", color: "#262421", fontFamily: FONT_BODY, minHeight: "100vh" }}
      className="flex items-center justify-center px-6"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm px-8 pt-8 pb-6" style={{ background: "#FFFFFF", border: "1px solid #EDE3D5" }}>
        <img src="/logo.png" alt="LUNAレンタルサロン" className="w-full max-w-[160px] h-auto mb-6 mx-auto" />
        <h1 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-lg font-bold mb-6 text-center">
          ログイン
        </h1>

        <label className="block text-xs mb-1" style={{ color: "#8F7D6E" }}>
          ユーザー名
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          className="w-full text-sm px-3 py-2 border mb-4"
          style={{ borderColor: "#EDE3D5" }}
        />

        <label className="block text-xs mb-1" style={{ color: "#8F7D6E" }}>
          パスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full text-sm px-3 py-2 border mb-4"
          style={{ borderColor: "#EDE3D5" }}
        />

        {error && (
          <p className="text-sm mb-4" style={{ color: "#A84434" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-sm px-3 py-2 disabled:opacity-40"
          style={{ background: "#D4A644", color: "#262421" }}
        >
          {loading ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
