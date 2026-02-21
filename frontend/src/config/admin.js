const ADMIN_TOKEN_STORAGE_KEY = "algo_sassy_admin_token";

export function getAdminToken() {
    const fromEnv = (import.meta.env.VITE_ADMIN_TOKEN || "").trim();
    if (fromEnv) {
        return fromEnv;
    }
    return (localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "").trim();
}

export function setAdminToken(token) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function withAdminHeaders(init = {}) {
    const token = getAdminToken();
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set("X-Admin-Token", token);
    }
    return { ...init, headers };
}
