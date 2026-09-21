import React from "react";
import { IconFileSpreadsheet, IconTrash, IconEdit, IconCheck, IconX } from "../components/Icons.jsx";

function fmtSize(rawBase64) {
  if (!rawBase64) return "";
  const bytes = Math.round((rawBase64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default function FilesPage({ files = [], onOpen, onRemove, onRename }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const [renameId, setRenameId] = React.useState(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [savingRename, setSavingRename] = React.useState(false);

  if (!files.length) {
    return (
      <div className="files-page">
        <div className="card">
          <div className="empty-state">
            <div className="big">&#128196;</div>
            <p>Belum ada file yang diimport.</p>
            <p className="text-muted">Gunakan menu Import Excel untuk mengimport file pertama.</p>
          </div>
        </div>
      </div>
    );
  }

  const target = files.find((f) => f.id === confirmId);
  const renameTarget = files.find((f) => f.id === renameId);

  const startRename = (f) => {
    setRenameId(f.id);
    setRenameValue(f.fileName || "");
    setSavingRename(false);
  };

  const submitRename = async () => {
    const name = renameValue.trim();
    if (!name || !renameTarget) return;
    if (name === renameTarget.fileName) {
      setRenameId(null);
      return;
    }
    setSavingRename(true);
    try {
      await onRename(renameTarget.id, name);
      setRenameId(null);
    } finally {
      setSavingRename(false);
    }
  };

  const renameInputRef = React.useRef(null);
  React.useEffect(() => {
    if (renameId) {
      const el = renameInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [renameId]);

  return (
    <div className="files-page">
      <div className="files-summary">
        <div className="stat-card">
          <div className="stat-icon purple">&#128202;</div>
          <div className="stat-info">
            <span className="label">Total File</span>
            <span className="value">{files.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">&#128196;</div>
          <div className="stat-info">
            <span className="label">Total Sheet</span>
            <span className="value">{files.reduce((n, f) => n + (f.sheetNames ? f.sheetNames.length : 0), 0)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>File Terimport</h2>
          <span className="badge masuk">{files.length} file</span>
        </div>
        <div className="card-body files-list">
          {files.map((f, i) => (
            <div key={f.id} className="files-list-row">
              <span className="files-list-ico">
                <IconFileSpreadsheet size={18} />
              </span>
              <div className="files-list-main">
                {renameId === f.id ? (
                  <div className="files-list-rename">
                    <input
                      ref={renameInputRef}
                      className="form-control files-list-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename();
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      maxLength={120}
                    />
                    <button className="btn btn-primary btn-sm" onClick={submitRename} disabled={savingRename} title="Simpan nama">
                      {savingRename ? "..." : <IconCheck size={16} />}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => setRenameId(null)} title="Batal">
                      <IconX size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="files-list-name" title={f.fileName}>
                      {f.fileName || `File ${i + 1}`}
                    </span>
                    <span className="files-list-meta">
                      {f.sheetNames ? `${f.sheetNames.length} sheet` : "- sheet"}
                      {fmtSize(f.rawBase64) ? ` &middot; ${fmtSize(f.rawBase64)}` : ""}
                      {" &middot; "}Updated {fmtDate(f.savedAt)}
                    </span>
                  </>
                )}
              </div>
              <div className="files-list-actions">
                <button className="btn btn-outline btn-sm" onClick={() => startRename(f)} title="Ubah nama file">
                  <IconEdit size={14} />
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => onOpen(f.id)} title="Buka file di Spreadsheet">
                  Buka
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setConfirmId(f.id)}
                  title="Hapus file"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <IconTrash size={13} />
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {target && (
        <div className="overlay" onClick={() => setConfirmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Hapus File</h3>
              <button className="modal-close" onClick={() => setConfirmId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Yakin ingin menghapus file <b>{target.fileName}</b>?</p>
              <p className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>File akan dihapus permanen dari daftar.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setConfirmId(null)}>Batal</button>
              <button className="btn btn-danger" onClick={() => { setConfirmId(null); onRemove(target.id); }}>Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}