// src/api/ventas.ts
// ============================================================
// API: ventas (fetch directo)
// ✅ Fix: normaliza base URL para evitar requests a Vite (5173)
// ============================================================

const RAW_API = import.meta.env.VITE_API_URL; // ej: http://localhost:3005 o http://localhost:3005/api
if (!RAW_API) console.warn("⚠️ VITE_API_URL no definido");

// ✅ Normaliza para que SIEMPRE quede .../api
const API_BASE = (() => {
  const base = String(RAW_API || "").replace(/\/+$/, "");
  if (!base) return "";
  return base.endsWith("/api") ? base : `${base}/api`;
})();

function qs(params?: Record<string, any>) {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("VITE_API_URL no está definido. Debe apuntar al backend (ej: http://localhost:3005).");
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let msg = "Error de red";
    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        msg = data?.message || msg;
      } else {
        const text = await res.text();
        if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
          msg = `La API devolvió HTML (no JSON). Revisá VITE_API_URL. URL: ${url}`;
        }
      }
    } catch {}
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
      throw new Error(`La API devolvió HTML (no JSON). Revisá VITE_API_URL. URL: ${url}`);
    }
    return text as unknown as T;
  }

  return (await res.json()) as T;
}

export type MedioPago =
  | "EFECTIVO"
  | "MP_QR"
  | "DEBITO"
  | "CREDITO"
  | "TRANSFERENCIA"
  | "OTRO";

export type Venta = {
  id: number;
  evento_id: number;
  caja_id: number;
  caja_sesion_id: number;
  usuario_id: number;
  fecha_hora: string;
  medio_pago: MedioPago;
  total: number;
  referencia_pago?: string | null;
  observaciones?: string | null;

  caja_nombre?: string;
  usuario_nombre?: string;
};

export type VentaDetalle = {
  id: number;
  venta_id: number;
  producto_evento_id: number;
  producto_id: number;
  subcomision_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;

  producto_nombre?: string;
  categoria?: string;
  subcomision_nombre?: string;
};

export function listarVentas(params: {
  evento_id: number;
  caja_id?: number;
  caja_sesion_id?: number;
  medio_pago?: MedioPago;
  fecha_desde?: string;
  fecha_hasta?: string;
}) {
  return http<Venta[]>(`/ventas${qs(params)}`);
}

export function obtenerVentaPorId(id: number) {
  return http<{ venta: Venta; detalles: VentaDetalle[] }>(`/ventas/${id}`);
}

export function crearVenta(data: {
  evento_id: number;
  caja_id: number;
  caja_sesion_id: number;
  usuario_id: number;
  medio_pago: MedioPago;
  observaciones?: string | null;
  referencia_pago?: string | null;
  items: { producto_evento_id: number; cantidad: number }[];
}) {
  return http<{ id: number }>(`/ventas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
