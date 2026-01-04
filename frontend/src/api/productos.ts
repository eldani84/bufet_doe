// src/api/productos.ts
// ============================================================
// 📡 API: PRODUCTOS
// - Incluye imagen_url y upload de imagen
// ============================================================

import { httpGet, httpPost, httpPut, httpDelete } from "./http";

const API = import.meta.env.VITE_API_URL;

export interface Producto {
  id: number;
  organizador_id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  imagen_url?: string | null;
  subcomision_propietaria_id: number;
  subcomision_nombre?: string | null;
  maneja_stock: 0 | 1;
  activo: 0 | 1;
}

export interface ListarProductosOptions {
  organizador_id: number;
  subcomision_id?: number;
  incluir_inactivos?: boolean;
}

export function listarProductos(options: ListarProductosOptions): Promise<Producto[]> {
  const q = new URLSearchParams();
  q.set("organizador_id", String(options.organizador_id));
  if (options.subcomision_id) q.set("subcomision_id", String(options.subcomision_id));
  if (options.incluir_inactivos) q.set("incluir_inactivos", "1");
  return httpGet(`/api/productos?${q.toString()}`);
}

export function crearProducto(data: {
  organizador_id: number;
  subcomision_propietaria_id: number;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  maneja_stock?: boolean;
  imagen_url?: string | null;
}): Promise<Producto> {
  return httpPost("/api/productos", data);
}

export function actualizarProducto(
  id: number,
  data: {
    nombre?: string;
    descripcion?: string | null;
    categoria?: string | null;
    imagen_url?: string | null;
    subcomision_propietaria_id?: number;
    maneja_stock?: boolean;
    activo?: boolean;
  }
): Promise<Producto> {
  return httpPut(`/api/productos/${id}`, data);
}

export function eliminarProducto(
  id: number
): Promise<{ message: string; id: number | string }> {
  return httpDelete(`/api/productos/${id}`);
}

// ------------------------------------------------------------
// Upload imagen (multipart/form-data)
// POST /api/productos/:id/imagen (field: "imagen")
// ------------------------------------------------------------
export async function subirImagenProducto(id: number, file: File): Promise<Producto> {
  if (!API) throw new Error("VITE_API_URL no está configurada.");

  const form = new FormData();
  form.append("imagen", file);

  const resp = await fetch(`${API}/api/productos/${id}/imagen`, {
    method: "POST",
    body: form,
  });

  const data = await resp.json().catch(() => null);

  if (!resp.ok) {
    throw new Error(data?.message || "No se pudo subir la imagen.");
  }

  return data as Producto;
}
