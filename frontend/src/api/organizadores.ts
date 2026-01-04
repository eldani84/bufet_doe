// src/api/organizadores.ts
// ============================================================
// 📡 API: ORGANIZADORES
// ============================================================

import { httpGet, httpPost, httpPut, httpDelete } from "./http";
import type { Organizador } from "./types";

export interface CrearOrganizadorInput {
  nombre: string;
  descripcion?: string;
  cuit_cuil?: string;
}

export interface ActualizarOrganizadorInput {
  nombre?: string;
  descripcion?: string | null;
  cuit_cuil?: string | null;
  activo?: boolean;
}

export interface ListarOrganizadoresOptions {
  incluir_inactivos?: boolean;
}

export function listarOrganizadores(
  options?: ListarOrganizadoresOptions
): Promise<Organizador[]> {
  const incluir = options?.incluir_inactivos ? "?incluir_inactivos=1" : "";
  return httpGet(`/api/organizadores${incluir}`);
}

export function obtenerOrganizador(id: number): Promise<Organizador> {
  return httpGet(`/api/organizadores/${id}`);
}

export function crearOrganizador(
  data: CrearOrganizadorInput
): Promise<Organizador> {
  return httpPost("/api/organizadores", data);
}

export function actualizarOrganizador(
  id: number,
  data: ActualizarOrganizadorInput
): Promise<Organizador> {
  return httpPut(`/api/organizadores/${id}`, data);
}

export function eliminarOrganizador(id: number): Promise<{ message: string; id: string | number }> {
  return httpDelete(`/api/organizadores/${id}`);
}
