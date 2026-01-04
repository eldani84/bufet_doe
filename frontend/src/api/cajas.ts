// src/api/cajas.ts
// ============================================================
// 🔗 API: CAJAS (ABM)
// - Usa http.ts (httpGet, httpPost, httpPut, httpDelete, apiPath, qs)
// ============================================================

import { httpGet, httpPost, httpPut, httpDelete, apiPath, qs } from "./http";

export type Caja = {
  id: number;
  evento_id: number;
  nombre: string;
  descripcion?: string | null;
  activo: 0 | 1 | boolean;
  evento_nombre?: string;
};

export function listarCajas(params?: {
  evento_id?: number;
  activo?: number | boolean;
}) {
  const query: Record<string, any> = {};
  if (params?.evento_id) query.evento_id = params.evento_id;
  if (typeof params?.activo !== "undefined") {
    query.activo =
      typeof params.activo === "boolean"
        ? params.activo
          ? 1
          : 0
        : params.activo;
  }

  const path = apiPath("/cajas" + qs(Object.keys(query).length ? query : undefined));
  return httpGet<Caja[]>(path);
}

export function obtenerCajaPorId(id: number) {
  const path = apiPath(`/cajas/${id}`);
  return httpGet<Caja>(path);
}

export function crearCaja(data: {
  evento_id: number;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean | 0 | 1;
}) {
  const payload = {
    ...data,
    activo:
      typeof data.activo === "boolean"
        ? data.activo
          ? 1
          : 0
        : typeof data.activo !== "undefined"
        ? data.activo
        : 1,
  };

  const path = apiPath("/cajas");
  return httpPost<Caja>(path, payload);
}

export function actualizarCaja(
  id: number,
  data: {
    evento_id?: number;
    nombre?: string;
    descripcion?: string | null;
    activo?: boolean | 0 | 1;
  }
) {
  const payload: any = { ...data };
  if (typeof data.activo !== "undefined") {
    payload.activo =
      typeof data.activo === "boolean"
        ? data.activo
          ? 1
          : 0
        : data.activo;
  }

  const path = apiPath(`/cajas/${id}`);
  return httpPut<Caja>(path, payload);
}

export function eliminarCaja(id: number) {
  const path = apiPath(`/cajas/${id}`);
  return httpDelete<{ message: string }>(path);
}
