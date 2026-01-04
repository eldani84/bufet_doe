// src/api/productosEvento.ts
// ============================================================
// API: productos_evento (fetch directo)
// ✅ Fix: normaliza base URL para evitar requests a Vite (5173)
// ✅ Fix: soporta imagen_url desde backend (p.imagen_url)
// ============================================================

const RAW_API = import.meta.env.VITE_API_URL; // ej: http://localhost:3005 o http://localhost:3005/api
if (!RAW_API) {
  console.warn("⚠️ VITE_API_URL no está definido");
}

// ✅ Normaliza para que SIEMPRE quede .../api  (sin doble /api)
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
    throw new Error(
      "VITE_API_URL no está definido. Debe apuntar al backend (ej: http://localhost:3005)."
    );
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  // ✅ Si devuelve HTML (por pegarle al frontend), damos error claro
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let msg = "Error de red";
    try {
      if (contentType.includes("application/json")) {
        const data = await res.json();
        msg = data?.message || msg;
      } else {
        const text = await res.text();
        if (
          text.trim().startsWith("<!doctype") ||
          text.trim().startsWith("<html")
        ) {
          msg = `La API devolvió HTML (no JSON). Revisá VITE_API_URL. URL: ${url}`;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;

  // ok
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (
      text.trim().startsWith("<!doctype") ||
      text.trim().startsWith("<html")
    ) {
      throw new Error(
        `La API devolvió HTML (no JSON). Revisá VITE_API_URL. URL: ${url}`
      );
    }
    // Si alguna vez devolvés texto OK, lo retornamos como T
    return text as unknown as T;
  }

  return (await res.json()) as T;
}

export type ProductoEvento = {
  id: number;
  evento_id: number;
  producto_id: number;
  precio_venta: number;
  stock_inicial: number;
  stock_actual: number;
  activo: number;

  producto_nombre?: string;
  producto_descripcion?: string;
  categoria?: string;

  // ✅ NUEVO: imagen del producto (viene de productos.imagen_url)
  // dejamos también variantes opcionales por compatibilidad futura
  imagen_url?: string | null;
  producto_imagen_url?: string | null;
  icono_url?: string | null;
  foto_url?: string | null;

  subcomision_nombre?: string;

  // ✅ Opción A (campo opcional por evento)
  subcomision_destino_id?: number | null;
  subcomision_destino_nombre?: string | null;
  subcomision_efectiva_nombre?: string | null;
};

/**
 * Backend espera solo_activos como:
 * - undefined  -> filtra activos (default)
 * - "1"        -> filtra activos
 * - "0"        -> NO filtra (incluye inactivos)
 *
 * Por eso acá lo enviamos como 1/0 (no true/false).
 */
export function listarProductosEvento(params: {
  evento_id: number;
  solo_activos?: boolean;
}) {
  const normalized = {
    ...params,
    solo_activos:
      typeof params.solo_activos === "undefined"
        ? undefined
        : params.solo_activos
        ? 1
        : 0,
  };

  return http<ProductoEvento[]>(`/productos-evento${qs(normalized)}`);
}

export function obtenerProductoEvento(id: number) {
  return http<ProductoEvento>(`/productos-evento/${id}`);
}

export function crearProductoEvento(data: {
  evento_id: number;
  producto_id: number;
  precio_venta: number;
  stock_inicial?: number;

  // ✅ opcional
  subcomision_destino_id?: number | null;
}) {
  return http<ProductoEvento>(`/productos-evento`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function actualizarProductoEvento(
  id: number,
  data: {
    precio_venta?: number;
    stock_inicial?: number;
    stock_actual?: number;
    activo?: boolean;

    // ✅ opcional
    subcomision_destino_id?: number | null;
  }
) {
  return http<ProductoEvento>(`/productos-evento/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function eliminarProductoEvento(id: number) {
  return http<{ message: string; id: string | number }>(
    `/productos-evento/${id}`,
    {
      method: "DELETE",
    }
  );
}
