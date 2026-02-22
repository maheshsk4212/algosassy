import { API_BASE_URL } from "./api";

const APP_TOKEN_STORAGE_KEY = "algo_sassy_app_token";

function normalizeToken(value) {
    return (value || "").trim();
}

export function getAppAccessToken() {
    return normalizeToken(localStorage.getItem(APP_TOKEN_STORAGE_KEY));
}

export function setAppAccessToken(token) {
    localStorage.setItem(APP_TOKEN_STORAGE_KEY, normalizeToken(token));
}

export function clearAppAccessToken() {
    localStorage.removeItem(APP_TOKEN_STORAGE_KEY);
}

function resolveRequestUrl(input) {
    if (input instanceof Request) {
        return input.url;
    }
    return String(input);
}

function shouldAttachAppToken(targetUrl) {
    try {
        const requestUrl = new URL(targetUrl, window.location.origin);
        const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
        if (requestUrl.origin !== apiOrigin) {
            return false;
        }
        return requestUrl.pathname.startsWith("/api/v1/") || requestUrl.pathname === "/metrics";
    } catch {
        return false;
    }
}

let fetchInterceptorInstalled = false;
const ACCESS_REQUIRED_EVENT = "algo_sassy_access_required";

function emitAccessRequiredEvent() {
    clearAppAccessToken();
    window.dispatchEvent(new CustomEvent(ACCESS_REQUIRED_EVENT));
}

export function getAccessRequiredEventName() {
    return ACCESS_REQUIRED_EVENT;
}

export function installAppAccessFetchInterceptor() {
    if (fetchInterceptorInstalled || typeof window === "undefined") {
        return;
    }
    fetchInterceptorInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const token = getAppAccessToken();
        if (!token) {
            return nativeFetch(input, init);
        }

        const requestUrl = resolveRequestUrl(input);
        if (!shouldAttachAppToken(requestUrl)) {
            return nativeFetch(input, init);
        }

        if (input instanceof Request) {
            const headers = new Headers(input.headers);
            if (!headers.has("X-App-Token")) {
                headers.set("X-App-Token", token);
            }
            return nativeFetch(new Request(input, { headers }), init).then((response) => {
                if (response.status === 401) {
                    emitAccessRequiredEvent();
                }
                return response;
            });
        }

        const headers = new Headers(init.headers || {});
        if (!headers.has("X-App-Token")) {
            headers.set("X-App-Token", token);
        }
        return nativeFetch(input, { ...init, headers }).then((response) => {
            if (response.status === 401) {
                emitAccessRequiredEvent();
            }
            return response;
        });
    };
}

export function withAppTokenQuery(urlValue) {
    const token = getAppAccessToken();
    if (!token) {
        return urlValue;
    }
    try {
        const target = new URL(urlValue, window.location.origin);
        if (!target.searchParams.has("app_token")) {
            target.searchParams.set("app_token", token);
        }
        return target.toString();
    } catch {
        return urlValue;
    }
}
