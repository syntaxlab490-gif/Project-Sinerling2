const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");
const { requireRole } = require("./auth");
const { logAudit } = require("./auditLog");

const router = express.Router();

// Seluruh route di sini dikunci: hanya Super Admin.
router.use(requireRole("super_admin"));

const ROLES = ["user", "admin", "super_admin"];

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

// ===== Manajemen User & Admin =====

router.get("/users", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nama, u.email, u.role, u.avatar, u.created_at,
              (SELECT COUNT(*) FROM admin_table_permissions p WHERE p.user_id = u.id) AS jumlah_tugas
       FROM users u
       ORDER BY u.id ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const nama = String(req.body.nama || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = ROLES.includes(req.body.role) ? req.body.role : "user";

    if (!nama || nama.length < 2) return res.status(400).json({ error: "Nama minimal 2 karakter" });
    if (!validateEmail(email)) return res.status(400).json({ error: "Format email tidak valid" });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter" });
    }
    const [[dup]] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (dup) return res.status(409).json({ error: "Email sudah terdaftar" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [nama, email, hash, role]
    );
    logAudit({
      userId: req.user.id,
      action: "create",
      module: "user",
      description: `Membuat akun "${nama}" (${email}) dengan peran ${role}`,
      recordId: result.insertId,
      newData: { nama, email, role, password_diset: !!password },
      req,
    });
    res.status(201).json({ id: result.insertId, message: "Pengguna berhasil dibuat" });
  } catch (err) {
    next(err);
  }
});

router.put("/users/:id", async (req, res, next) => {
  try {
    const uid = Number(req.params.id);
    const [[user]] = await pool.query("SELECT id, nama, email, role FROM users WHERE id = ?", [uid]);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });

    const sets = [];
    const params = [];

    if (req.body.nama !== undefined) {
      const n = String(req.body.nama).trim();
      if (!n || n.length < 2) return res.status(400).json({ error: "Nama minimal 2 karakter" });
      sets.push("nama = ?");
      params.push(n);
    }
    if (req.body.email !== undefined) {
      const em = String(req.body.email).trim().toLowerCase();
      if (!validateEmail(em)) return res.status(400).json({ error: "Format email tidak valid" });
      const [[dupe]] = await pool.query("SELECT id FROM users WHERE email = ? AND id <> ?", [em, uid]);
      if (dupe) return res.status(409).json({ error: "Email sudah terdaftar" });
      sets.push("email = ?");
      params.push(em);
    }
    if (req.body.password !== undefined && String(req.body.password) !== "") {
      const pw = String(req.body.password);
      if (pw.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
      const hash = await bcrypt.hash(pw, 10);
      sets.push("password_hash = ?");
      params.push(hash);
    }
    if (req.body.role !== undefined) {
      const role = req.body.role;
      if (!ROLES.includes(role)) return res.status(400).json({ error: "Role tidak valid" });
      // Jangan biarkan Super Admin menurunkan dirinya sendiri.
      if (uid === req.user.id && role !== "super_admin") {
        return res.status(400).json({ error: "Anda tidak dapat menurunkan role pada diri sendiri" });
      }
      // Pastikan minimal satu Super Admin tetap ada.
      if (user.role === "super_admin" && role !== "super_admin") {
        const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'");
        if (Number(n) <= 1) {
          return res.status(400).json({ error: "Minimal harus ada satu Super Admin" });
        }
      }
      sets.push("role = ?");
      params.push(role);
    }
    if (sets.length === 0) return res.status(400).json({ error: "Tidak ada yang diubah" });

    params.push(uid);
    await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
    logAudit({
      userId: req.user.id,
      action: "update",
      module: "user",
      description: `Memperbarui akun "${user.nama}" (${user.email})`,
      recordId: uid,
      oldData: { nama: user.nama, email: user.email, role: user.role },
      newData: {
        nama: req.body.nama !== undefined ? String(req.body.nama).trim() : user.nama,
        email: req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : user.email,
        role: req.body.role !== undefined ? req.body.role : user.role,
        password_diganti: !!req.body.password,
      },
      req,
    });
    res.json({ message: "Pengguna berhasil diperbarui" });
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const uid = Number(req.params.id);
    if (uid === req.user.id) {
      return res.status(400).json({ error: "Anda tidak dapat menghapus akun sendiri" });
    }
    const [[user]] = await pool.query("SELECT id, nama, email, role FROM users WHERE id = ?", [uid]);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "super_admin") {
      const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'");
      if (Number(n) <= 1) {
        return res.status(400).json({ error: "Minimal harus ada satu Super Admin" });
      }
    }
    logAudit({
      userId: req.user.id,
      action: "delete",
      module: "user",
      description: `Menghapus akun "${user.nama}" (${user.email})`,
      recordId: uid,
      oldData: { nama: user.nama, email: user.email, role: user.role },
      req,
    });
    await pool.query("DELETE FROM sessions WHERE user_id = ?", [uid]);
    await pool.query("DELETE FROM admin_table_permissions WHERE user_id = ?", [uid]);
    await pool.query("DELETE FROM users WHERE id = ?", [uid]);
    res.json({ message: "Pengguna berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

// ===== Penugasan Tabel untuk Admin (entry/edit data) =====

async function tableExists(tipe, tabelId) {
  const tableName = tipe === "spreadsheet" ? "spreadsheet" : "kategori";
  const [[row]] = await pool.query(`SELECT id FROM \`${tableName}\` WHERE id = ?`, [tabelId]);
  return !!row;
}

router.get("/permissions", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.user_id, p.tipe, p.tabel_id, p.can_entry, p.can_edit, p.created_at,
              u.nama AS nama_user,
              CASE p.tipe
                WHEN 'kategori' THEN (SELECT k.nama_kategori FROM kategori k WHERE k.id = p.tabel_id)
                WHEN 'spreadsheet' THEN (SELECT sp.nama FROM spreadsheet sp WHERE sp.id = p.tabel_id)
              END AS nama_tabel
       FROM admin_table_permissions p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/permissions", async (req, res, next) => {
  try {
    const userId = Number(req.body.userId);
    const tipe = req.body.tipe === "spreadsheet" ? "spreadsheet" : "kategori";
    const tabelId = Number(req.body.tabelId);
    if (!userId || !tabelId) {
      return res.status(400).json({ error: "User dan tabel wajib diisi" });
    }
    const [[user]] = await pool.query("SELECT id, role FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role !== "admin") {
      return res.status(400).json({ error: "Penugasan tabel hanya untuk pengguna berperan Admin" });
    }
    if (!(await tableExists(tipe, tabelId))) {
      return res.status(404).json({ error: "Tabel/spreadsheet tidak ditemukan" });
    }
    const canEntry = req.body.canEntry !== false ? 1 : 0;
    const canEdit = req.body.canEdit !== false ? 1 : 0;
    await pool.query(
      `INSERT INTO admin_table_permissions (user_id, tipe, tabel_id, can_entry, can_edit)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE can_entry = VALUES(can_entry), can_edit = VALUES(can_edit)`,
      [userId, tipe, tabelId, canEntry, canEdit]
    );
    logAudit({
      userId: req.user.id,
      action: "update",
      module: "permission",
      description: `Menugaskan "${tipe}" tabel #${tabelId} ke user #${userId} (entry:${canEntry ? "ya" : "tidak"}, edit:${canEdit ? "ya" : "tidak"})`,
      recordId: tabelId,
      newData: { userId, tipe, tabelId, canEntry: !!canEntry, canEdit: !!canEdit },
      req,
    });
    res.status(201).json({ message: "Penugasan berhasil disimpan" });
  } catch (err) {
    next(err);
  }
});

router.put("/permissions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[perm]] = await pool.query("SELECT id, user_id, tipe, tabel_id FROM admin_table_permissions WHERE id = ?", [id]);
    if (!perm) return res.status(404).json({ error: "Penugasan tidak ditemukan" });

    const canEntry = req.body.canEntry !== false ? 1 : 0;
    const canEdit = req.body.canEdit !== false ? 1 : 0;
    await pool.query(
      "UPDATE admin_table_permissions SET can_entry = ?, can_edit = ? WHERE id = ?",
      [canEntry, canEdit, id]
    );
    logAudit({
      userId: req.user.id,
      action: "update",
      module: "permission",
      description: `Mengubah izin penugasan #${id} (entry:${canEntry ? "ya" : "tidak"}, edit:${canEdit ? "ya" : "tidak"})`,
      recordId: perm.tabel_id,
      newData: { permissionId: id, userId: perm.user_id, tipe: perm.tipe, tabelId: perm.tabel_id, canEntry: !!canEntry, canEdit: !!canEdit },
      req,
    });
    res.json({ message: "Penugasan berhasil diperbarui" });
  } catch (err) {
    next(err);
  }
});

router.delete("/permissions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[perm]] = await pool.query("SELECT id, user_id, tipe, tabel_id FROM admin_table_permissions WHERE id = ?", [id]);
    if (!perm) return res.status(404).json({ error: "Penugasan tidak ditemukan" });
    const [result] = await pool.query("DELETE FROM admin_table_permissions WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Penugasan tidak ditemukan" });
    logAudit({
      userId: req.user.id,
      action: "delete",
      module: "permission",
      description: `Menghapus penugasan izin #${id}`,
      recordId: perm.tabel_id,
      oldData: { permissionId: id, userId: perm.user_id, tipe: perm.tipe, tabelId: perm.tabel_id },
      req,
    });
    res.json({ message: "Penugasan berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

// ===== Maintenance Mode =====

router.get("/maintenance", async (_req, res, next) => {
  try {
    const [[row]] = await pool.query("SELECT svalue FROM app_settings WHERE skey = 'maintenance'");
    let cfg = {};
    if (row && row.svalue) {
      try { cfg = typeof row.svalue === "string" ? JSON.parse(row.svalue) : row.svalue; } catch {}
    }
    res.json({
      active: !!cfg.active,
      title: cfg.title || "Maintenance",
      message: cfg.message || "",
      start_at: cfg.start_at || null,
      end_at: cfg.end_at || null,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/maintenance", async (req, res, next) => {
  try {
    // Gabungkan dengan konfigurasi yang sudah ada agar field yang tidak dikirim
    // tidak tertimpa default.
    const [[cur]] = await pool.query("SELECT svalue FROM app_settings WHERE skey = 'maintenance'");
    let prev = {};
    if (cur && cur.svalue) {
      try { prev = typeof cur.svalue === "string" ? JSON.parse(cur.svalue) : cur.svalue; } catch {}
    }
    const active = req.body.active !== undefined ? !!req.body.active : !!prev.active;
    const title = req.body.title !== undefined ? String(req.body.title).trim() : (prev.title || "Maintenance");
    const message = req.body.message !== undefined ? String(req.body.message).trim() : (prev.message || "");
    const start_at = req.body.start_at !== undefined ? (req.body.start_at || null) : (prev.start_at || null);
    const end_at = req.body.end_at !== undefined ? (req.body.end_at || null) : (prev.end_at || null);
    const cfg = { active, title, message, start_at, end_at };
    await pool.query(
      `INSERT INTO app_settings (skey, svalue) VALUES ('maintenance', ?)
       ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)`,
      [JSON.stringify(cfg)]
    );
    logAudit({
      userId: req.user.id,
      action: active ? "update" : "update",
      module: "maintenance",
      description: active ? "Mengaktifkan mode maintenance" : "Menonaktifkan mode maintenance",
      oldData: { active: !!prev.active, title: prev.title || "", end_at: prev.end_at || null },
      newData: cfg,
      req,
    });
    res.json({ message: active ? "Maintenance diaktifkan" : "Maintenance dinonaktifkan", ...cfg });
  } catch (err) {
    next(err);
  }
});

// ===== Pengaturan umum =====

router.get("/settings", async (_req, res, next) => {
  try {
    const [[allowReg]] = await pool.query("SELECT svalue FROM app_settings WHERE skey = 'allow_register'");
    let allowRegister = true;
    if (allowReg && allowReg.svalue) {
      try { allowRegister = (typeof allowReg.svalue === "string" ? JSON.parse(allowReg.svalue) : allowReg.svalue) !== false; } catch {}
    }
    res.json({ allow_register: allowRegister });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    const allowRegister = req.body.allow_register !== false;
    await pool.query(
      `INSERT INTO app_settings (skey, svalue) VALUES ('allow_register', ?)
       ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)`,
      [JSON.stringify(allowRegister)]
    );
    logAudit({
      userId: req.user.id,
      action: "update",
      module: "settings",
      description: allowRegister ? "Mengizinkan pendaftaran terbuka" : "Menonaktifkan pendaftaran terbuka",
      newData: { allow_register: allowRegister },
      req,
    });
    res.json({ message: "Pengaturan berhasil disimpan", allow_register: allowRegister });
  } catch (err) {
    next(err);
  }
});

// ===== Backup / Restore =====

const EXCLUDED_TABLES = ["sessions", "backups"];

async function listAppTables() {
  const [rows] = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  );
  return rows.map((r) => r.table_name || r.TABLE_NAME).filter((t) => !EXCLUDED_TABLES.includes(t));
}

router.get("/backups", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.nama, b.ukuran, b.created_at, u.nama AS dibuat_oleh
       FROM backups b LEFT JOIN users u ON u.id = b.dibuat_oleh
       ORDER BY b.id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/backups", async (req, res, next) => {
  try {
    const tables = await listAppTables();
    const dump = {};
    for (const t of tables) {
      const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
      dump[t] = rows;
    }
    const payload = JSON.stringify({ version: 1, dibuat: new Date().toISOString(), tables: dump });
    const ukuran = Buffer.byteLength(payload, "utf8");
    if (ukuran > 12000000) {
      return res.status(413).json({ error: "Ukuran backup terlalu besar untuk disimpan di database" });
    }
    const nama = String(req.body.nama || "").trim() || `Backup ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    const [result] = await pool.query(
      "INSERT INTO backups (nama, isi, ukuran, dibuat_oleh) VALUES (?, ?, ?, ?)",
      [nama, payload, ukuran, req.user.id]
    );
    logAudit({
      userId: req.user.id,
      action: "create",
      module: "backup",
      description: `Membuat backup "${nama}" (${Object.keys(dump).length} tabel, ${Math.round(ukuran / 1024)} KB)`,
      recordId: result.insertId,
      newData: { nama, ukuran, tables: Object.keys(dump) },
      req,
    });
    res.status(201).json({
      id: result.insertId,
      nama,
      ukuran,
      message: `Backup berhasil dibuat (${Object.keys(dump).length} tabel)`,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/backups/:id", async (req, res, next) => {
  try {
    const [[row]] = await pool.query("SELECT * FROM backups WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Backup tidak ditemukan" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${String(row.nama).replace(/[^a-zA-Z0-9 _.-]/g, "_")}.json"`);
    res.send(row.isi);
  } catch (err) {
    next(err);
  }
});

router.delete("/backups/:id", async (req, res, next) => {
  try {
    const [[old]] = await pool.query("SELECT id, nama FROM backups WHERE id = ?", [req.params.id]);
    if (!old) return res.status(404).json({ error: "Backup tidak ditemukan" });
    const [result] = await pool.query("DELETE FROM backups WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Backup tidak ditemukan" });
    logAudit({
      userId: req.user.id,
      action: "delete",
      module: "backup",
      description: `Menghapus backup "${old.nama}"`,
      recordId: req.params.id,
      oldData: { nama: old.nama },
      req,
    });
    res.json({ message: "Backup berhasil dihapus" });
  } catch (err) {
    next(err);
  }
});

// Restore = MERGE (upsert). Tidak ada aksi DROP/TRUNCATE/DELETE sehingga data
// yang tidak ada di dalam backup tetap aman.
router.post("/backups/:id/restore", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const [[row]] = await pool.query("SELECT * FROM backups WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ error: "Backup tidak ditemukan" });
    if (!row.isi) return res.status(400).json({ error: "Isi backup kosong" });

    const parsed = JSON.parse(row.isi);
    const tables = parsed && parsed.tables ? parsed.tables : {};
    const existing = await listAppTables();
    const report = {};

    await conn.beginTransaction();
    for (const [t, rows] of Object.entries(tables)) {
      if (!existing.includes(t) || !Array.isArray(rows) || rows.length === 0) continue;
      const [meta] = await conn.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [t]
      );
      const colsMeta = [];
      meta.forEach((m) => {
        colsMeta.push({
          name: m.column_name || m.COLUMN_NAME,
          type: String(m.data_type || m.DATA_TYPE || "").toLowerCase(),
        });
      });
      if (colsMeta.length === 0) continue;
      const cols = colsMeta.map((c) => c.name);

      // Normalisasi nilai datetime: '2026-01-01T10:00:00.000Z' → '2026-01-01 10:00:00'.
      const normalize = (c, val) => {
        if (val === null || val === undefined) return null;
        const type = c.type;
        // Kolom JSON: mysql2 mengembalikan objek ter-parse, serahkan sebagai teks JSON.
        if (type === "json" && (typeof val === "object" || Array.isArray(val))) {
          return JSON.stringify(val);
        }
        if (typeof val !== "string") return val;
        const isDateTime = type.includes("datetime") || type.includes("timestamp");
        const isDate = type === "date";
        if (!isDateTime && !isDate) return val;
        const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/.exec(val);
        if (!m) return val;
        return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5]}:${m[6]}` : ""}`;
      };

      let restored = 0;
      // Batch 500 baris per kueri.
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500).filter((r) => r && typeof r === "object");
        if (batch.length === 0) continue;
        const colList = cols.join(", ");
        // Kolom JSON di-CAST agar selalu valid; sisanya parameter biasa.
        const valueExprs = colsMeta.map((c) => (c.type === "json" ? "CAST(? AS JSON)" : "?"));
        const placeholders = batch
          .map(() => `(${valueExprs.join(", ")})`)
          .join(", ");
        const updateParts = colsMeta.map((c) => `\`${c.name}\` = VALUES(\`${c.name}\`)`).join(", ");
        const values = [];
        for (const r of batch) {
          for (const c of colsMeta) values.push(normalize(c, r[c.name]));
        }
        await conn.query(
          `INSERT INTO \`${t}\` (${colList}) VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE ${updateParts}`,
          values
        );
        restored += batch.length;
      }
      report[t] = restored;
    }

    await conn.commit();
    logAudit({
      userId: req.user.id,
      action: "restore",
      module: "backup",
      description: `Meng-restore backup "${row.nama}" (${Object.keys(report).length} tabel)`,
      recordId: row.id,
      newData: { nama: row.nama, report },
      req,
    });
    res.json({ message: "Restore selesai (merging, data tidak dihapus)", report });
  } catch (err) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ error: "Gagal restore", detail: err.message });
  } finally {
    conn.release();
  }
});

module.exports = { adminRouter: router };