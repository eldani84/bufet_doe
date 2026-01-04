// src/api/http.ts
// ============================================================
// 🔗 Cliente HTTP básico para el sistema BUFET_DOE
// - Base URL desde VITE_API_URL (ej: http://localhost:3005)
// - Todas las APIs llaman a /api/*
// - Manejo consistente de errores
// - ✅ apiPath() garantiza que el path tenga el prefijo /api
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3005";
const API_BASE = String(BASE_URL).replace(/\/+$/, "");

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// ✅ helper: arma querystring
export function qs(params?: Record<string, any>) {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ✅ helper: asegura que el path apunte a /api y empiece con "/"
export function apiPath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  // si ya viene /api/... no lo duplicamos
  return p.startsWith("/api/") ? p : `/api${p}`;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<T> {
  // 🔴 AQUÍ se normaliza siempre el path con /api
  const fullPath = apiPath(path);
  const url = `${API_BASE}${fullPath}`;

  const res = await fetch(url, {
    method,
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    // Si el backend respondió JSON con {message}
    if (payload && typeof payload === "object" && (payload as any).message) {
      throw new Error((payload as any).message);
    }

    // Si respondió HTML (ej: Vite index) -> error clarísimo
    if (typeof payload === "string" && payload.trim().startsWith("<!doctype")) {
      throw new Error(
        `La API devolvió HTML (no JSON). Revisá VITE_API_URL. URL: ${url}`
      );
    }

    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  // Si viene texto y era ok, lo devolvemos igual
  return payload as T;
}

// Helpers públicos — se mantienen igual en el resto del código
export function httpGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function httpPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function httpPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function httpDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
