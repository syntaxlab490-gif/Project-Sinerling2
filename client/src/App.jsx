import React from "react";
import Layout from "./components/Layout.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import KategoriPage from "./pages/KategoriPage.jsx";
import Laporan from "./pages/Laporan.jsx";
import ExcelImport from "./pages/ExcelImport.jsx";
import ExcelResult from "./pages/ExcelResult.jsx";
import ExcelEditor from "./pages/ExcelEditor.jsx";
import FilesPage from "./pages/FilesPage.jsx";
import Panduan from "./pages/Panduan.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import { AdminUsers, AdminTables, AdminMaintenance, AdminBackup, AdminSettings, MaintenancePage } from "./pages/AdminPages.jsx";
import { loadFiles, saveFile, removeFile, generateId, clearAllFiles, hydrateFiles } from "./excelStorage.js";
import { api } from "./api.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import { getToken, getUser, setAuth, clearAuth, updateStoredUser, isSuperAdmin, hasMaintenanceBypass, canEditData } from "./auth.js";

export default function App() {
  const [page, setPage] = React.useState("spreadsheet");
  const [importedFiles, setImportedFiles] = React.useState(() => loadFiles());
  const [activeFileId, setActiveFileId] = React.useState(null);

  const [user, setUser] = React.useState(() => getUser());
  const [authChecked, setAuthChecked] = React.useState(false);
  const [authPage, setAuthPage] = React.useState("login");
  const [maintenance, setMaintenance] = React.useState(null);

  React.useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setAuthChecked(true);
      return;
    }
    api.me()
      .then((res) => {
        setAuth(res.token, res.user);
        setUser(res.user);
      })
      .catch(() => {
        clearAuth();
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // Cek status maintenance secara berkala (dipakai untuk gerbang halaman).
  const pollMaintenance = React.useCallback(async () => {
    try {
      const res = await api.getStatus();
      setMaintenance(res.maintenance || null);
    } catch {
      /* abaikan; jika server mati biarkan status sebelumnya */
    }
  }, []);

  React.useEffect(() => {
    pollMaintenance();
    const t = setInterval(pollMaintenance, 45000);
    return () => clearInterval(t);
  }, [pollMaintenance]);

  // Apakah maintenance sedang aktif untuk pengguna ini (selalu bypass karena login dinonaktifkan).
  const maintenanceBlocking = !!(maintenance && maintenance.active && !hasMaintenanceBypass(user));

  // Pulihkan file terimport dari IndexedDB (kuota localStorage tidak cukup untuk
  // file Excel berukuran besar) lalu segarkan daftar file di UI. Setelah ini,
  // localStorage juga ikut disinkronkan sebagai cache kilat.
  React.useEffect(() => {
    let alive = true;
    hydrateFiles()
      .then(() => {
        if (alive) setImportedFiles(loadFiles());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (importedFiles.length > 0) {
      saveFile(importedFiles[importedFiles.length - 1]);
    }
  }, [importedFiles]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Sesi yang sudah tidak valid tetap dibersihkan di client.
    }
    clearAuth();
    setUser(null);
    setPage("spreadsheet");
  };

  const handleUserUpdated = (u) => {
    setUser((current) => {
      const next = { ...current, ...(u || {}) };
      updateStoredUser(next);
      return next;
    });
  };

  const handleAccountDeleted = () => {
    clearAllFiles();
    setImportedFiles([]);
    setActiveFileId(null);
    setPage("spreadsheet");
  };

  const handleImport = (data) => {
    const id = generateId();
    const entry = {
      id,
      fileName: data.fileName,
      workbook: data.workbook,
      sheetNames: data.sheetNames,
      rawBase64: data.rawBase64 || "",
    };
    setImportedFiles((prev) => [...prev, entry]);
    setActiveFileId(id);
    setPage("import-result");
  };

  const handleRemoveFile = (fileId) => {
    removeFile(fileId);
    setImportedFiles((prev) => {
      const next = prev.filter((f) => f.id !== fileId);
      if (next.length === 0) {
        setPage("import-excel");
        setActiveFileId(null);
      } else if (activeFileId === fileId) {
        setActiveFileId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const handleRenameFile = (fileId, namaBaru) => {
    const entry = importedFiles.find((f) => f.id === fileId);
    if (!entry) return;
    const trimmed = String(namaBaru || "").trim();
    if (!trimmed) return;
    saveFile({ id: entry.id, fileName: trimmed, workbook: entry.workbook, rawBase64: entry.rawBase64 });
    setImportedFiles(loadFiles());
  };

  const handleSelectFile = (fileId) => {
    setActiveFileId(fileId);
    setPage("import-result");
  };

  const handleOpenFileInSpreadsheet = (fileId) => {
    setActiveFileId(fileId);
    setPage("spreadsheet");
  };

  const activeFile = importedFiles.find((f) => f.id === activeFileId) || null;

  if (!authChecked) return null;
  if (!user) {
    return (
      <ToastProvider>
        {authPage === "register" ? (
          <Register onRegister={(token, nextUser) => { setAuth(token, nextUser); setUser(nextUser); }} onSwitchToLogin={() => setAuthPage("login")} />
        ) : (
          <Login onLogin={(token, nextUser) => { setAuth(token, nextUser); setUser(nextUser); }} onSwitchToRegister={() => setAuthPage("register")} />
        )}
      </ToastProvider>
    );
  }

  // Saat maintenance aktif, User & Admin hanya melihat halaman maintenance.
  if (maintenanceBlocking) {
    return (
      <ToastProvider>
        <MaintenancePage maintenance={maintenance} onLogout={handleLogout} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Layout
        page={page}
        setPage={setPage}
        importedFiles={importedFiles}
        user={user}
        onLogout={handleLogout}
        onUserUpdated={handleUserUpdated}
        onAccountDeleted={handleAccountDeleted}
      >
        {page === "dashboard" && <Dashboard onNavigate={setPage} user={user} />}
        {page === "spreadsheet" && (
          <ExcelEditor
            importedFiles={importedFiles}
            onFilesChanged={() => setImportedFiles(loadFiles())}
            readOnly={!canEditData(user)}
            openFileId={activeFileId}
          />
        )}
        {page === "files" && (
          <FilesPage
            files={importedFiles}
            onOpen={handleOpenFileInSpreadsheet}
            onRemove={handleRemoveFile}
            onRename={handleRenameFile}
          />
        )}
        {page === "kategori" && <KategoriPage />}
        {page === "laporan" && <Laporan />}
        {page === "panduan" && <Panduan user={user} />}
        {canEditData(user) && page === "audit-log" && <AuditLogs user={user} />}
        {isSuperAdmin(user) && page === "import-excel" && (
          <ExcelImport onImport={handleImport} fileCount={importedFiles.length} />
        )}
        {page === "import-result" && activeFile && (
          <ExcelResult
            importedData={activeFile}
            allFiles={importedFiles}
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onRemoveFile={handleRemoveFile}
            onImportMore={() => setPage("import-excel")}
          />
        )}
        {isSuperAdmin(user) && page === "admin-users" && <AdminUsers user={user} />}
        {isSuperAdmin(user) && page === "admin-tables" && <AdminTables />}
        {isSuperAdmin(user) && page === "admin-maintenance" && <AdminMaintenance />}
        {isSuperAdmin(user) && page === "admin-backup" && <AdminBackup />}
        {isSuperAdmin(user) && page === "admin-settings" && <AdminSettings />}
      </Layout>
    </ToastProvider>
  );
}
