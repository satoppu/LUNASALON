import { useEffect, useState } from "react";
import { NotebookPen, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api.js";
import { FONT_HEAD } from "../constants.js";

export default function PageNotes({ pageKey }) {
  const [open, setOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [todo, setTodo] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(false);
    api
      .getPageNote(pageKey)
      .then((note) => {
        setReflection(note.reflection || "");
        setTodo(note.todo || "");
        setUpdatedAt(note.updated_at);
      })
      .catch(() => {});
  }, [pageKey]);

  async function handleSave() {
    setSaving(true);
    try {
      const note = await api.savePageNote(pageKey, { reflection, todo });
      setUpdatedAt(note.updated_at);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8" style={{ background: "#FFFFFF", border: "1px solid #EDE3D5" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: "#7A6A5C" }}
      >
        <span className="flex items-center gap-2 text-sm font-medium" style={{ fontFamily: FONT_HEAD, color: "#262421" }}>
          <NotebookPen size={15} />
          振り返り・やる事メモ
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: "#8F7D6E" }}>
              振り返り
            </label>
            <textarea
              value={reflection}
              onChange={(e) => {
                setReflection(e.target.value);
                setDirty(true);
              }}
              rows={4}
              placeholder="気づいたこと、良かった点・課題など"
              className="w-full text-sm p-2 border"
              style={{ borderColor: "#EDE3D5", background: "#FCF8F0", color: "#262421" }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: "#8F7D6E" }}>
              やる事
            </label>
            <textarea
              value={todo}
              onChange={(e) => {
                setTodo(e.target.value);
                setDirty(true);
              }}
              rows={4}
              placeholder="次にやるべきこと"
              className="w-full text-sm p-2 border"
              style={{ borderColor: "#EDE3D5", background: "#FCF8F0", color: "#262421" }}
            />
          </div>
          <div className="flex md:flex-col items-center md:items-end justify-end gap-2 md:w-32 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="text-sm px-3 py-2 disabled:opacity-40"
              style={{ background: "#D4A644", color: "#262421" }}
            >
              {saving ? "保存中…" : "保存"}
            </button>
            {updatedAt && !dirty && (
              <p className="text-xs whitespace-nowrap" style={{ color: "#8F7D6E" }}>
                保存済み
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
