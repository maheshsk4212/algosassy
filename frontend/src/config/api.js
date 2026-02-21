function normalizeBaseUrl(value) {
    return (value || "").trim().replace(/\/+$/, "");
}

const host = window.location.hostname || "localhost";
const httpProtocol = window.location.protocol === "https:" ? "https:" : "http:";

const localApiBaseUrl = `${httpProtocol}//${host}:8000`;
const configuredApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const configuredWsBaseUrl = normalizeBaseUrl(import.meta.env.VITE_WS_BASE_URL);

export const API_BASE_URL = configuredApiBaseUrl || localApiBaseUrl;
export const WS_BASE_URL =
    configuredWsBaseUrl ||
    API_BASE_URL.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");

export function apiUrl(path) {
    if (!path.startsWith("/")) {
        return `${API_BASE_URL}/${path}`;
    }
    return `${API_BASE_URL}${path}`;
}
