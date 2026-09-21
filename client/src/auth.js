const TOKEN_KEY = "sisnerling_token";
const USER_KEY = "sisnerling_user";
export { TOKEN_KEY, USER_KEY };

export const ROLE_LABELS = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || "User";
}

export function canEditData(user) {
  return user?.role === "admin" || user?.role === "super_admin";
}

// Apakah pengguna boleh mengubah struktur/konfigurasi (khusus Super Admin).
// Login dinonaktifkan: selalu boleh.
export function isSuperAdmin(user) {
  return user?.role === "super_admin";
}

// Apakah pengguna boleh beroperasi penuh saat maintenance.
// Login dinonaktifkan: selalu boleh.
export function hasMaintenanceBypass(user) {
  return user?.role === "super_admin";
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const value = localStorage.getItem(USER_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function updateStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
