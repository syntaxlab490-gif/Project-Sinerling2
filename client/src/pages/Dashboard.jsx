import React from "react";
import Modal from "../components/Modal.jsx";
import SpreadsheetCharts from "../components/SpreadsheetCharts.jsx";
import PerbandinganData from "../components/PerbandinganData.jsx";
import { getSheets } from "../spreadsheetWorkbook.js";
import { sheetsToTables } from "../perbandinganUtils.js";
import { roleLabel } from "../auth.js";

export default function Dashboard({ onNavigate, user }) {
  const [showInfo, setShowInfo] = React.useState(false);
  const [tables, setTables] = React.useState(() => sheetsToTables(getSheets()));

  React.useEffect(() => {
    const refresh = () => setTables(sheetsToTables(getSheets()));
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const hour = new Date().getHours();
  const sapaan = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";
  const nama = user?.nama ? user.nama.split(" ")[0] : "Pengguna";
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const quickMenus = [
    { key: "spreadsheet", title: "Spreadsheet", desc: "Isi & kelola data tabel", icon: "▦", grad: "qm-green" },
    { key: "kategori", title: "Kategori", desc: "Kelompok Hutan, Mineral, dll", icon: "◧", grad: "qm-violet" },
    { key: "laporan", title: "Laporan", desc: "Ringkasan & neraca", icon: "▤", grad: "qm-blue" },
    { key: "files", title: "File Terimport", desc: "Kelola berkas Excel", icon: "▣", grad: "qm-amber" },
  ];

  return (
    <div className="dash-premium">
      {/* HERO */}
      <section className="dash-hero">
        <div className="dash-hero-bg" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
          <span className="grid-overlay" />
        </div>
        <div className="dash-hero-content">
          <div className="dash-hero-left">
            <div className="dash-eyebrow">
              <span className="pulse-dot" />
              Sistem Neraca Lingkungan · Live
              {user?.role && <span className="dash-role-pill">{roleLabel(user.role)}</span>}
            </div>
            <h1 className="dash-title">
              {sapaan}, <span className="dash-name">{nama}</span> 👋
            </h1>
            <p className="dash-sub">
              {isAdmin
                ? "Kelola data input–output, pantau progres spreadsheet, dan susun laporan neraca dalam satu dasbor terpadu."
                : "Pantau statistik data, lihat progres spreadsheet, dan jelajahi laporan neraca lingkungan secara ringkas."}
            </p>
            <div className="dash-hero-actions">
              <button type="button" className="dash-btn-primary" onClick={() => onNavigate?.("spreadsheet")}>
                <span>→</span> Buka Spreadsheet
              </button>
              <button type="button" className="dash-btn-ghost" onClick={() => setShowInfo(true)}>
                ⓘ Cara kerja sistem
              </button>
            </div>
            <div className="dash-hero-meta">
              <div className="dash-meta-item"><strong>{tables.length}</strong><span>Tabel aktif</span></div>
              <div className="dash-meta-divider" />
              <div className="dash-meta-item"><strong>{tables.reduce((a, t) => a + (t?.rows?.length || 0), 0)}</strong><span>Total baris</span></div>
              <div className="dash-meta-divider" />
              <div className="dash-meta-item"><strong>{isAdmin ? "Edit" : "Lihat"}</strong><span>Hak akses</span></div>
            </div>
          </div>
          <div className="dash-hero-right">
            <div className="dash-float-card fc-1">
              <span className="fc-icon">📊</span>
              <div><strong>Grafik otomatis</strong><small>Bar · Donut · Line</small></div>
            </div>
            <div className="dash-float-card fc-2">
              <span className="fc-icon">📥</span>
              <div><strong>Import Excel</strong><small>.xlsx sekali klik</small></div>
            </div>
            <div className="dash-main-illus">
              <div className="illus-bar" style={{ height: "38%" }} />
              <div className="illus-bar" style={{ height: "64%" }} />
              <div className="illus-bar" style={{ height: "48%" }} />
              <div className="illus-bar" style={{ height: "82%" }} />
              <div className="illus-bar" style={{ height: "58%" }} />
            </div>
          </div>
        </div>
      </section>

      {/* QUICK MENU */}
      <section className="dash-quick">
        {quickMenus.map((m) => (
          <button key={m.key} type="button" className={`dash-quick-card ${m.grad}`} onClick={() => onNavigate?.(m.key)}>
            <span className="dq-icon">{m.icon}</span>
            <span className="dq-body">
              <strong>{m.title}</strong>
              <small>{m.desc}</small>
            </span>
            <span className="dq-arrow">→</span>
          </button>
        ))}
      </section>

      {/* INFO BANNER */}
      <button type="button" className="info-card info-card-premium" onClick={() => setShowInfo(true)}>
        <span className="info-card-icon">💡</span>
        <span className="info-card-body">
          <span className="info-card-title">Selamat Datang di SISNERLING</span>
          <span className="info-card-desc">
            Sistem ini digunakan untuk mengolah data input–output secara terpusat. Anda dapat memasukkan atau
            mengimpor data spreadsheet, mengelolanya berdasarkan kategori (Hutan, Mineral, Energi, Uang, dan
            lainnya), lalu memantau statistik dan progres seluruh data melalui Dashboard ini.
          </span>
        </span>
        <span className="info-card-action">
          <span>Selengkapnya</span>
          <span className="info-card-arrow">→</span>
        </span>
      </button>

      <SpreadsheetCharts />

      <div className="card card-premium mt">
        <PerbandinganData tables={tables} title="Perbandingan Data" />
      </div>

      {showInfo && (
        <Modal
          title="Penjelasan Sistem"
          onClose={() => setShowInfo(false)}
          footer={
            <button type="button" className="btn btn-primary" onClick={() => setShowInfo(false)}>
              Tutup
            </button>
          }
        >
          <div className="info-modal">
            <h4>Tentang Sistem</h4>
            <p>
              <b>Sisnerling</b> adalah sistem pengolahan data input–output yang memungkinkan Anda mengelola
              sekumpulan data berbentuk spreadsheet secara terpusat dan terstruktur. Seluruh data disimpan dan
              diproses dalam satu aplikasi sehingga mudah untuk dimasukkan, dipantau, dianalisis, dan dilaporkan.
            </p>

            <h4>Fungsi Utama</h4>
            <ul>
              <li><b>Spreadsheet:</b> halaman untuk membuat, mengisi, dan mengedit data dalam bentuk tabel spreadsheet.</li>
              <li><b>Kategori:</b> mengelompokkan data ke dalam kategori seperti Hutan, Mineral, Energi, dan Uang, lengkap dengan sub-kategorinya.</li>
              <li><b>Laporan &amp; Neraca:</b> menyusun ringkasan dan neraca dari data yang sudah dimasukkan.</li>
              <li><b>Import Excel:</b> mengimpor data dari berkas Excel (xlsx) agar tidak perlu mengetik ulang.</li>
              <li><b>Dashboard:</b> halaman saat ini yang menampilkan statistik dan grafik progres seluruh data secara ringkas.</li>
            </ul>

            <h4>Cara Penggunaan</h4>
            <ol>
              <li>Mulai dari menu <b>Spreadsheet</b> untuk membuat atau mengimpor data Anda.</li>
              <li>Gunakan menu <b>Kategori</b> apabila ingin mengelompokkan data berdasarkan jenis atau bidang tertentu.</li>
              <li>Kembali ke <b>Dashboard</b> untuk melihat ringkasan statistik, total nilai, dan grafik setiap sheet.</li>
              <li>Gunakan menu <b>Laporan</b>, <b>Neraca</b>, atau <b>Import Excel</b> sesuai kebutuhan pelaporan dan impor data.</li>
            </ol>

            <h4>Informasi Penting</h4>
            <ul>
              <li>Statistik pada Dashboard diperbarui otomatis dari data Spreadsheet yang tersimpan.</li>
              <li>Jika belum ada data, masuklah ke halaman <b>Spreadsheet</b> lalu isi atau impor data terlebih dahulu.</li>
              <li>Angka pada Dashboard ditampilkan dalam format ribuan agar lebih mudah dibaca.</li>
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}
