const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sisnerling_db",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
};

const pool = mysql.createPool(config);

async function initDatabase() {
  const admin = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
  );
  await admin.query(`USE \`${config.database}\`;`);

  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  await admin.query(schema);

  await admin.query(
    `UPDATE kategori SET nama_kategori = 'Neraca Fisik & Moneter Hutan', deskripsi = 'Data neraca fisik & moneter hutan' WHERE nama_kategori = 'Pegawai'`
  );
  await admin.query(
    `UPDATE kategori SET nama_kategori = 'Neraca Aset Mineral & Energi', deskripsi = 'Data neraca aset mineral & energi' WHERE nama_kategori = 'Barang'`
  );
  await admin.query(
    `UPDATE kategori SET nama_kategori = 'Neraca Terintegrasi', deskripsi = 'Data neraca terintegrasi' WHERE nama_kategori = 'Keuangan'`
  );
  await admin.query(
    `DELETE FROM kategori WHERE nama_kategori = 'Lainnya'`
  );

  const [[col]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'data_barang' AND column_name = 'formulas'`
  );
  if (Number(col.n) === 0) {
    await admin.query("ALTER TABLE data_barang ADD COLUMN formulas JSON NULL");
  }

  const [[colNilai]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'data_barang' AND column_name = 'nilai'`
  );
  if (Number(colNilai.n) === 0) {
    await admin.query("ALTER TABLE data_barang ADD COLUMN nilai JSON NULL");
  }

  const [[colKolom]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'kategori' AND column_name = 'kolom'`
  );
  if (Number(colKolom.n) === 0) {
    await admin.query("ALTER TABLE kategori ADD COLUMN kolom JSON NULL");
  }

  const [[colJumlahType]] = await admin.query(
    `SELECT DATA_TYPE AS t FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'data_barang' AND column_name = 'jumlah'`
  );
  if (colJumlahType && colJumlahType.t && colJumlahType.t.toLowerCase() !== "bigint") {
    await admin.query("ALTER TABLE data_barang MODIFY COLUMN jumlah BIGINT NOT NULL DEFAULT 0");
  }

  const [[colSubKat]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'data_barang' AND column_name = 'sub_kategori_id'`
  );
  if (Number(colSubKat.n) === 0) {
    await admin.query("ALTER TABLE data_barang ADD COLUMN sub_kategori_id INT NULL");
  }

  const [[colSheetId]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'data_barang' AND column_name = 'sheet_id'`
  );
  if (Number(colSheetId.n) === 0) {
    await admin.query("ALTER TABLE data_barang ADD COLUMN sheet_id INT NULL");
  }

  const [[colIcon]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'kategori' AND column_name = 'icon'`
  );
  if (Number(colIcon.n) === 0) {
    await admin.query("ALTER TABLE kategori ADD COLUMN icon VARCHAR(50) NULL AFTER deskripsi");
  }

  const [[colSubIcon]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'sub_kategori' AND column_name = 'icon'`
  );
  if (Number(colSubIcon.n) === 0) {
    await admin.query("ALTER TABLE sub_kategori ADD COLUMN icon VARCHAR(50) NULL AFTER deskripsi");
  }

  const [[colAvatar]] = await admin.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar'`
  );
  if (Number(colAvatar.n) === 0) {
    await admin.query("ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL");
  }

  // ---- Kompatibilitas DB lama (versi username): samakan skema users ----
  // DB teman masih memakai kolom legacy: username NOT NULL, email NULLABLE,
  // role ENUM('admin','user') tanpa super_admin. Migrasi idempoten di bawah
  // menyamakan dengan skema baru tanpa menghapus data.
  try {
    const [[hasUsername]] = await admin.query(
      `SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'username'`
    );
    const [[colRole]] = await admin.query(
      `SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'`
    );
    if (Number(hasUsername.n) > 0) {
      // Isi email kosong dari username agar bisa UNIQUE + NOT NULL.
      await admin.query(
        `UPDATE users SET email = LOWER(CONCAT(COALESCE(username, CONCAT('user', id)), '@local'))
         WHERE email IS NULL OR email = ''`
      );
      // Hilangkan duplikat email hasil backfill (tambah suffix id).
      const [dups] = await admin.query(
        `SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1`
      );
      for (const d of dups) {
        const [rows] = await admin.query(`SELECT id FROM users WHERE email = ? ORDER BY id`, [d.email]);
        for (let i = 1; i < rows.length; i++) {
          await admin.query(`UPDATE users SET email = ? WHERE id = ?`, [`user${rows[i].id}@local`, rows[i].id]);
        }
      }
      await admin.query(
        `ALTER TABLE users MODIFY COLUMN role ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user'`
      );
      await admin.query(`ALTER TABLE users MODIFY COLUMN username VARCHAR(50) NULL`);
      await admin.query(`ALTER TABLE users MODIFY COLUMN email VARCHAR(190) NOT NULL`);
      const [[hasUq]] = await admin.query(
        `SELECT COUNT(*) AS n FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'uq_users_email'`
      );
      if (Number(hasUq.n) === 0) {
        await admin.query(`ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)`);
      }
    } else if (Number(colRole.n) === 0) {
      await admin.query(
        "ALTER TABLE users ADD COLUMN role ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user' AFTER email"
      );
    } else {
      // Pastikan enum role selalu mencakup super_admin walau kolom sudah ada.
      await admin.query(
        `ALTER TABLE users MODIFY COLUMN role ENUM('user','admin','super_admin') NOT NULL DEFAULT 'user'`
      );
    }
  } catch (e) {
    console.warn("Migrasi kompatibilitas users dilewati:", e.code || e.message);
  }

  // ---- Tabel pendukung: pengaturan, izin entry admin per tabel, backup ----
  await admin.query(`CREATE TABLE IF NOT EXISTS app_settings (
    skey VARCHAR(100) NOT NULL PRIMARY KEY,
    svalue JSON NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await admin.query(`CREATE TABLE IF NOT EXISTS admin_table_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tipe ENUM('kategori','spreadsheet') NOT NULL,
    tabel_id INT NOT NULL,
    can_entry TINYINT(1) NOT NULL DEFAULT 1,
    can_edit TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_perms (user_id, tipe, tabel_id),
    KEY idx_perms_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await admin.query(`CREATE TABLE IF NOT EXISTS backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(200) NOT NULL,
    isi MEDIUMTEXT NULL,
    ukuran INT NOT NULL DEFAULT 0,
    dibuat_oleh INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);

  // ---- Audit log: jejak aktivitas penting pengguna ----
  await admin.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(50) NOT NULL,
    description VARCHAR(500) NULL,
    module VARCHAR(50) NOT NULL DEFAULT 'system',
    record_id INT NULL,
    old_data JSON NULL,
    new_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(300) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_audit_user (user_id),
    KEY idx_audit_created (created_at),
    KEY idx_audit_module (module),
    KEY idx_audit_action (action),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // ---- Seed SUPER ADMIN (hanya bila variabel env diset & belum ada) ----
  const seedEmail = (process.env.SEED_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const seedPass = process.env.SEED_SUPER_ADMIN_PASSWORD || "";
  if (seedEmail && seedPass) {
    const [[superCount]] = await admin.query(
      `SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'`
    );
    if (Number(superCount.n) === 0) {
      const [[dup]] = await admin.query("SELECT id FROM users WHERE email = ?", [seedEmail]);
      const nama = (process.env.SEED_SUPER_ADMIN_NAMA || "Super Admin").trim();
      const hash = await bcrypt.hash(seedPass, 10);
      if (dup) {
        await admin.query("UPDATE users SET role = 'super_admin', password_hash = ? WHERE id = ?", [hash, dup.id]);
      } else {
        const seedUsername = seedEmail.split("@")[0].slice(0, 50);
        try {
          await admin.query(
            "INSERT INTO users (nama, email, username, password_hash, role) VALUES (?, ?, ?, ?, 'super_admin')",
            [nama, seedEmail, seedUsername, hash]
          );
        } catch (e) {
          if (e.code === "ER_BAD_FIELD_ERROR") {
            await admin.query(
              "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, 'super_admin')",
              [nama, seedEmail, hash]
            );
          } else throw e;
        }
      }
      console.log(`Super Admin siap: ${seedEmail} (via SEED_* env)`);
    }
  }

  // Indeks tabel sessions (dibuat dengan pengecekan agar idempoten).
  const ensureIndex = async (table, index, cols) => {
    const [[idx]] = await admin.query(
      `SELECT COUNT(*) AS n FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, index]
    );
    if (Number(idx.n) === 0) {
      await admin.query(
        `CREATE INDEX \`${index}\` ON \`${table}\` (${cols})`
      );
    }
  };
  await ensureIndex("sessions", "idx_sessions_token", "token");
  await ensureIndex("sessions", "idx_sessions_user", "user_id");

  await admin.end();
}

module.exports = { pool, initDatabase };
