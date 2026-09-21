import React from "react";
import { api, formatNumber, formatTanggal } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { roleLabel } from "../auth.js";
import AuthField from "../components/AuthField.jsx";

const ROLE_BADGE = {
  user: { background: "linear-gradient(135deg,#eef2ff,#e0e7ff)", color: "#4338ca", dot: "#6366f1", label: "User" },
  admin: { background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", color: "#047857", dot: "#10b981", label: "Admin" },
  super_admin: { background: "linear-gradient(135deg,#fef3c7,#fde68a)", color: "#92400e", dot: "#f59e0b", label: "Super Admin" },
};

function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || ROLE_BADGE.user;
  return (
    <span className="adm-role-badge" style={{ background: s.background, color: s.color }}>
      <span className="adm-role-dot" style={{ background: s.dot }} />
      {roleLabel(role)}
    </span>
  );
}

function PageHero({ icon, title, desc, stats }) {
  return (
    <div className="adm-hero">
      <div className="adm-hero-bg" aria-hidden="true"><span className="orb orb-1" /><span className="orb orb-2" /></div>
      <div className="adm-hero-icon">{icon}</div>
      <div className="adm-hero-text">
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      {stats && stats.length > 0 && (
        <div className="adm-hero-stats">
          {stats.map((s, i) => (
            <div key={i} className="adm-hero-stat">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ title, message, onCancel, onConfirm, danger }) {
  return (
    <div className="adm-confirm-overlay" onClick={onCancel}>
      <div className="adm-confirm" onClick={(e) => e.stopPropagation()}>
        <div className={`adm-confirm-icon ${danger ? "danger" : ""}`}>{danger ? "⚠" : "?"}</div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="adm-confirm-actions">
          <button className="btn btn-outline" onClick={onCancel}>Batal</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>Ya, Lanjutkan</button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      className={`adm-switch ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <span className="adm-switch-knob" />
    </button>
  );
}

function initials(nama) {
  if (!nama) return "U";
  const parts = String(nama).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_GRADS = [
  "linear-gradient(135deg,#6366f1,#8b5cf6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#10b981,#0ea5e9)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#14b8a6,#059669)",
];
function avatarGrad(id) {
  return AVATAR_GRADS[Number(id || 0) % AVATAR_GRADS.length];
}

// ====== 1. Manajemen User & Admin ======

export function AdminUsers({ user: currentUser }) {
  const toast = useToast();
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState({ nama: "", email: "", password: "", role: "user" });
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");

  const fetchAll = React.useCallback(async () => {
    try {
      setUsers(await api.getAdminUsers());
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const startEdit = (u) => {
    setEditing(u);
    setForm({ nama: u.nama, email: u.email, password: "", role: u.role });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startCreate = () => {
    setEditing(null);
    setForm({ nama: "", email: "", password: "", role: "user" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const body = { nama: form.nama, email: form.email, role: form.role };
        if (form.password) body.password = form.password;
        await api.updateAdminUser(editing.id, body);
        toast("Pengguna berhasil diperbarui");
      } else {
        await api.createAdminUser(form);
        toast("Pengguna berhasil dibuat");
      }
      setEditing(null);
      startCreate();
      await fetchAll();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await api.deleteAdminUser(deleteTarget.id);
      toast("Pengguna berhasil dihapus");
      setDeleteTarget(null);
      await fetchAll();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const isSelf = (u) => currentUser && u.id === currentUser.id;

  const quickRole = async (u, role) => {
    try {
      await api.updateAdminUser(u.id, { role });
      toast(`${u.nama} kini berperan ${roleLabel(role)}`);
      await fetchAll();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || `${u.nama} ${u.email}`.toLowerCase().includes(q);
    const matchR = roleFilter === "all" || u.role === roleFilter;
    return matchQ && matchR;
  });

  const cUser = users.filter((u) => u.role === "user").length;
  const cAdmin = users.filter((u) => u.role === "admin").length;
  const cSuper = users.filter((u) => u.role === "super_admin").length;

  return (
    <div className="adm-page">
      <PageHero
        icon="👥"
        title="User & Admin Management"
        desc="Atur akun pengguna, admin, dan super admin beserta hak aksesnya dalam satu tempat."
        stats={[
          { value: users.length, label: "Total" },
          { value: cUser, label: "User" },
          { value: cAdmin, label: "Admin" },
          { value: cSuper, label: "Super Admin" },
        ]}
      />

      <div className="card card-premium adm-form-card">
        <div className="adm-form-head">
          <div>
            <h3>{editing ? `✏️ Ubah — ${editing.nama}` : "✨ Tambah Pengguna Baru"}</h3>
            <p>{editing ? "Perbarui nama, email, password, atau peran pengguna." : "Buat akun baru lengkap dengan peran & hak akses."}</p>
          </div>
          {editing && (
            <button className="btn btn-outline btn-sm" type="button" onClick={startCreate}>+ Mode tambah</button>
          )}
        </div>
        <form onSubmit={submit} className="adm-form-grid">
          <div className="form-group">
            <label>Nama lengkap</label>
            <input className="form-control" value={form.nama} onChange={set("nama")} placeholder="cth: Budi Santoso" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" required />
          </div>
          <AuthField
            label={`Password ${editing ? "(kosongkan bila tetap)" : ""}`}
            type="password"
            autoComplete={editing ? "new-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
            placeholder={editing ? "•••••••" : "Minimal 6 karakter"}
          />
          <div className="form-group">
            <label>Role / Peran</label>
            <select className="form-control" value={form.role} onChange={set("role")}>
              <option value="user">👁️ User — lihat saja</option>
              <option value="admin">✍️ Admin — entry sesuai tugas</option>
              <option value="super_admin">👑 Super Admin — penuh</option>
            </select>
          </div>
          <div className="adm-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "💾 Simpan Perubahan" : "＋ Tambah Pengguna"}
            </button>
            {editing && (
              <button className="btn btn-outline" type="button" onClick={startCreate}>Batal</button>
            )}
          </div>
        </form>
      </div>

      <div className="card card-premium">
        <div className="adm-table-toolbar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama atau email..." />
          </div>
          <div className="adm-filter-chips">
            {[["all", "Semua"], ["user", "User"], ["admin", "Admin"], ["super_admin", "Super"]].map(([v, l]) => (
              <button key={v} type="button" className={`adm-chip ${roleFilter === v ? "on" : ""}`} onClick={() => setRoleFilter(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Role</th>
                <th>Tugas</th>
                <th>Bergabung</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5"><div className="loading"><div><div className="spinner" />Memuat pengguna...</div></div></td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className={isSelf(u) ? "row-selected" : ""}>
                  <td>
                    <div className="adm-user-cell">
                      <span className="adm-avatar" style={{ background: avatarGrad(u.id) }}>{initials(u.nama)}</span>
                      <div className="adm-user-meta">
                        <strong>{u.nama}{isSelf(u) && <span className="adm-you">Anda</span>}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td><span className="adm-task-pill">{u.jumlah_tugas || 0} tabel</span></td>
                  <td className="text-muted">{formatTanggal(u.created_at)}</td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      {!isSelf(u) && u.role === "user" && (
                        <button className="btn btn-sm btn-soft" title="Jadikan Admin" onClick={() => quickRole(u, "admin")}>→ Admin</button>
                      )}
                      {!isSelf(u) && u.role === "admin" && (
                        <button className="btn btn-sm btn-outline" title="Turunkan ke User" onClick={() => quickRole(u, "user")}>→ User</button>
                      )}
                      <button className="btn btn-sm btn-outline" disabled={isSelf(u)} onClick={() => startEdit(u)}>Ubah</button>
                      <button className="btn btn-sm btn-danger" disabled={isSelf(u)} onClick={() => setDeleteTarget(u)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="5"><div className="empty-state"><div className="big">🔍</div><p>Tidak ada pengguna yang cocok.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Pengguna"
          message={`Hapus akun "${deleteTarget.nama}" (${deleteTarget.email})? Data yang sudah tersimpan tidak ikut dihapus.`}
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

// ====== 2. Penugasan Tabel untuk Admin ======

export function AdminTables() {
  const toast = useToast();
  const [perms, setPerms] = React.useState([]);
  const [admins, setAdmins] = React.useState([]);
  const [kategori, setKategori] = React.useState([]);
  const [spreadsheets, setSpreadsheets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ userId: "", tipe: "kategori", tabelId: "", canEntry: true, canEdit: true });

  const fetchAll = React.useCallback(async () => {
    try {
      const [p, users, kat, sp] = await Promise.all([
        api.getAdminPermissions(),
        api.getAdminUsers(),
        api.getKategori().catch(() => []),
        api.getSpreadsheet().catch(() => []),
      ]);
      setPerms(p);
      setAdmins(users.filter((u) => u.role === "admin"));
      setKategori(kat);
      setSpreadsheets(sp);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.userId || !form.tabelId) {
      toast("Pilih admin dan tabel tujuan", "error");
      return;
    }
    try {
      await api.createAdminPermission(form);
      toast("Penugasan berhasil disimpan");
      await fetchAll();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const toggleFlag = async (perm, key, val) => {
    try {
      await api.updateAdminPermission(perm.id, { canEntry: key === "can_entry" ? val : perm.can_entry, canEdit: key === "can_edit" ? val : perm.can_edit });
      setPerms((prev) => prev.map((p) => (p.id === perm.id ? { ...p, [key]: val } : p)));
      toast("Perizinan diperbarui");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const remove = async (perm) => {
    try {
      await api.deleteAdminPermission(perm.id);
      setPerms((prev) => prev.filter((p) => p.id !== perm.id));
      toast("Penugasan dihapus");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const tabelOptions = form.tipe === "spreadsheet" ? spreadsheets : kategori;
  const tabelLabel = form.tipe === "spreadsheet" ? "nama" : "nama_kategori";

  return (
    <div className="adm-page">
      <PageHero
        icon="🗂️"
        title="Penugasan Tabel"
        desc="Tentukan tabel/kategori & spreadsheet mana yang boleh di-entry atau diedit oleh tiap Admin."
        stats={[
          { value: admins.length, label: "Admin" },
          { value: perms.length, label: "Penugasan" },
          { value: kategori.length, label: "Kategori" },
        ]}
      />

      <div className="card card-premium adm-form-card">
        <div className="adm-form-head">
          <div>
            <h3>➕ Tugas Baru</h3>
            <p>Admin hanya dapat menambah & mengubah data pada tabel yang ditetapkan.</p>
          </div>
        </div>
        <form onSubmit={submit} className="adm-form-grid adm-grid-3">
          <div className="form-group">
            <label>Admin</label>
            <select className="form-control" value={form.userId} onChange={set("userId")}>
              <option value="">Pilih admin...</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.nama} ({a.email})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Jenis Tabel</label>
            <select className="form-control" value={form.tipe} onChange={(e) => { set("tipe")(e); setForm((f) => ({ ...f, tabelId: "" })); }}>
              <option value="kategori">📁 Kategori (Neraca)</option>
              <option value="spreadsheet">📊 Spreadsheet</option>
            </select>
          </div>
          <div className="form-group">
            <label>Nama Tabel</label>
            <select className="form-control" value={form.tabelId} onChange={set("tabelId")}>
              <option value="">Pilih tabel...</option>
              {tabelOptions.map((t) => <option key={t.id} value={t.id}>{t[tabelLabel]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Boleh Entry</label>
            <Toggle value={form.canEntry} onChange={(v) => setForm((f) => ({ ...f, canEntry: v }))} />
          </div>
          <div className="form-group">
            <label>Boleh Edit / Hapus</label>
            <Toggle value={form.canEdit} onChange={(v) => setForm((f) => ({ ...f, canEdit: v }))} />
          </div>
          <div className="adm-form-actions">
            <button className="btn btn-primary" type="submit">＋ Tambah Tugas</button>
          </div>
        </form>
      </div>

      <div className="card card-premium">
        <div className="table-wrap">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Jenis</th>
                <th>Tabel</th>
                <th style={{ width: 110 }}>Entry</th>
                <th style={{ width: 110 }}>Edit/Hapus</th>
                <th style={{ width: 90, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6"><div className="loading"><div><div className="spinner" />Memuat...</div></div></td></tr>
              ) : perms.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="adm-user-cell">
                      <span className="adm-avatar sm" style={{ background: avatarGrad(p.user_id) }}>{initials(p.nama_user)}</span>
                      <strong>{p.nama_user || `User #${p.user_id}`}</strong>
                    </div>
                  </td>
                  <td><span className={`adm-jenis ${p.tipe}`}>{p.tipe === "spreadsheet" ? "📊 Spreadsheet" : "📁 Kategori"}</span></td>
                  <td className="font-bold">{p.nama_tabel || `Tabel #${p.tabel_id}`}</td>
                  <td><Toggle value={p.can_entry} onChange={(v) => toggleFlag(p, "can_entry", v ? 1 : 0)} /></td>
                  <td><Toggle value={p.can_edit} onChange={(v) => toggleFlag(p, "can_edit", v ? 1 : 0)} /></td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Hapus</button></td>
                </tr>
              ))}
              {!loading && perms.length === 0 && (
                <tr><td colSpan="6"><div className="empty-state"><div className="big">📋</div><p>Belum ada penugasan. Tambahkan di form atas.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ====== 3. Maintenance Mode ======

export function AdminMaintenance() {
  const toast = useToast();
  const [form, setForm] = React.useState({ active: false, title: "Maintenance", message: "", start_at: "", end_at: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.getMaintenance().then((m) => {
      setForm({
        active: !!m.active,
        title: m.title || "Maintenance",
        message: m.message || "",
        start_at: (m.start_at || "").slice(0, 16),
        end_at: (m.end_at || "").slice(0, 16),
      });
    }).catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        active: form.active,
        title: form.title,
        message: form.message,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      };
      const res = await api.setMaintenance(body);
      toast(res.message || "Pengaturan maintenance disimpan");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <PageHero icon="🛠️" title="Maintenance Mode" desc="Blokir sementara akses User & Admin. Super Admin tetap dapat masuk." stats={[{ value: form.active ? "ON" : "OFF", label: "Status" }]} />
      <div className="card card-premium" style={{ padding: 22, maxWidth: 680 }}>
        <div className={`adm-status-banner ${form.active ? "on" : "off"}`}>
          <span className="adm-status-dot" />
          {form.active ? "Maintenance AKTIF — pengguna biasa diblokir" : "Sistem berjalan normal"}
        </div>
        <form onSubmit={submit} style={{ marginTop: 16 }}>
          <div className="form-group">
            <label className="adm-check-label">
              <Toggle value={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <strong>Aktifkan Maintenance sekarang</strong>
            </label>
          </div>
          <div className="form-group">
            <label>Judul</label>
            <input className="form-control" value={form.title} onChange={set("title")} placeholder="Maintenance" />
          </div>
          <div className="form-group">
            <label>Pesan untuk pengguna</label>
            <textarea className="form-control" rows="3" value={form.message} onChange={set("message")} placeholder="Sedang perbaikan sistem, mohon kembali nanti." />
          </div>
          <div className="adm-form-grid adm-grid-2">
            <div className="form-group">
              <label>Mulai (opsional)</label>
              <input className="form-control" type="datetime-local" value={form.start_at} onChange={set("start_at")} />
            </div>
            <div className="form-group">
              <label>Selesai (opsional)</label>
              <input className="form-control" type="datetime-local" value={form.end_at} onChange={set("end_at")} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : form.active ? "🚀 Simpan & Nyalakan" : "💾 Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ====== 4. Backup / Restore ======

export function AdminBackup() {
  const toast = useToast();
  const [backups, setBackups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [restoreTarget, setRestoreTarget] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const fetchAll = React.useCallback(async () => {
    try {
      setBackups(await api.getBackups());
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await api.createBackup();
      toast(res.message);
      await fetchAll();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const restore = async () => {
    try {
      const res = await api.restoreBackup(restoreTarget.id);
      const lines = Object.entries(res.report || {})
        .map(([t, n]) => `${t}: ${formatNumber(n)} baris`)
        .join(", ");
      toast(`Restore selesai. ${lines}`);
      setRestoreTarget(null);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const remove = async () => {
    try {
      await api.deleteBackup(deleteTarget.id);
      toast("Backup berhasil dihapus");
      setDeleteTarget(null);
      await fetchAll();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const fmtUkuran = (n) => {
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${n} B`;
  };

  return (
    <div className="adm-page">
      <PageHero icon="💾" title="Backup & Restore" desc="Amankan data sebelum perubahan besar. Restore bersifat menggabung tanpa menghapus data lain." stats={[{ value: backups.length, label: "Arsip backup" }]} />

      <div className="adm-backup-grid">
        <div className="card card-premium adm-backup-cta">
          <div className="adm-backup-cta-icon">📦</div>
          <h3>Buat titik aman baru</h3>
          <p>Seluruh tabel (kecuali sesi login & arsip backup) disalin menjadi satu berkas JSON yang aman.</p>
          <button className="btn btn-primary btn-block" onClick={create} disabled={creating}>
            {creating ? "Membuat backup..." : "＋ Buat Backup Baru"}
          </button>
        </div>
        <div className="card card-premium">
          <div className="card-header"><h2>Riwayat Backup ({backups.length})</h2></div>
          <div className="adm-backup-list">
            {loading && <div className="loading"><div><div className="spinner" />Memuat...</div></div>}
            {!loading && backups.length === 0 && (
              <div className="empty-state"><div className="big">📦</div><p>Belum ada backup. Buat backup pertama Anda.</p></div>
            )}
            {backups.map((b) => (
              <div key={b.id} className="adm-backup-item">
                <span className="adm-backup-file">🗄️</span>
                <div className="adm-backup-meta">
                  <strong>{b.nama}</strong>
                  <small>{fmtUkuran(b.ukuran || 0)} · {b.dibuat_oleh ? `${b.dibuat_oleh} · ` : ""}{formatTanggal(b.created_at)}</small>
                </div>
                <div className="row-actions">
                  <a className="btn btn-sm btn-outline" href={api.downloadBackupUrl(b.id)} download>Unduh</a>
                  <button className="btn btn-sm btn-soft" onClick={() => setRestoreTarget(b)}>Restore</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(b)}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {restoreTarget && (
        <ConfirmDialog
          title="Restore Backup"
          message={`Pulihkan data dari backup "${restoreTarget.nama}"? Proses ini MENGGABUNG (upsert) data backup ke tabel yang ada — tidak menghapus data lain.`}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={restore}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Backup"
          message={`Hapus backup "${deleteTarget.nama}"? File yang sudah diunduh tidak terpengaruh.`}
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}

// ====== 5. Pengaturan Umum ======

export function AdminSettings() {
  const toast = useToast();
  const [allowRegister, setAllowRegister] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.getAdminSettings().then((s) => setAllowRegister(s.allow_register !== false)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.setAdminSettings({ allow_register: allowRegister });
      toast(res.message);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-page">
      <PageHero icon="⚙️" title="Pengaturan Sistem" desc="Pengaturan umum aplikasi SISNERLING." />
      <div className="card card-premium" style={{ padding: 22, maxWidth: 680 }}>
        <form onSubmit={submit}>
          <div className="adm-setting-row">
            <div>
              <strong>📝 Pendaftaran terbuka</strong>
              <p>Bila dimatikan, semua akun dibuat oleh Super Admin di panel User & Admin.</p>
            </div>
            <Toggle value={allowRegister} onChange={setAllowRegister} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 16 }}>
            {saving ? "Menyimpan..." : "💾 Simpan Pengaturan"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ====== Halaman maintenance untuk User/Admin ======

export function MaintenancePage({ maintenance, onLogout }) {
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-hero" />
        <div className="auth-col">
          <div className="auth-card" style={{ textAlign: "center" }}>
            <div className="brand-logo" style={{ margin: "0 auto 14px", width: 52, height: 52, fontSize: 24 }}>S</div>
            <h1 className="auth-title">{maintenance?.title || "Sedang Maintenance"}</h1>
            <p className="auth-subtitle" style={{ whiteSpace: "pre-line" }}>
              {maintenance?.message || "Sistem sedang dalam perawatan. Silakan kembali beberapa saat lagi."}
            </p>
            {maintenance?.end_at && (
              <p className="text-muted" style={{ fontSize: 13 }}>
                Diperkirakan selesai: {new Date(maintenance.end_at).toLocaleString("id-ID")}
              </p>
            )}
            <button className="btn btn-primary btn-block" onClick={onLogout}>
              Keluar / Ganti Akun
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
