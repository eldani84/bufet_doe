// src/pages/VentasPOSPage.tsx
// ============================================================
// 🧾 POS - VENTAS POR EVENTO (BUFET_DOE)
// - Ruta: /eventos/:eventoId/ventas
// - Encabezado con 2 tarjetas:
//      ▸ Datos operativos: seleccionar caja, usuario y abrir/cerrar sesión
//      ▸ Caja: saldo efectivo + Ingreso/Egreso manual
// - Layout 50/50: catálogo izquierda, carrito derecha
// - Catálogo en tarjetas clickeables (sin botón "Agregar")
// - Filtro por categoría con botones dinámicos (toggle)
// - Cobro en MODAL al presionar “Cobrar / Confirmar venta”
// - Saldo de caja (BACKEND):
//      monto_inicial_efectivo
//      + ventas EFECTIVO de la sesión
//      + ingresos manuales EFECTIVO
//      - retiros EFECTIVO
// - Apertura de caja con opción:
//      ▸ Monto manual
//      ▸ Usar saldo del último cierre como monto inicial
//
// ✅ FIX IMÁGENES (sin romper lo existente):
// - Resolver URL robusta:
//    • soporta campos: imagen_url, producto_imagen_url, icono_url, foto_url, imagen, image_url, url, etc.
//    • si viene "uploads/xxx.jpg" (sin slash) lo transforma a "/uploads/xxx.jpg"
//    • si viene solo "xxx.jpg" lo transforma a "/uploads/xxx.jpg"
//    • si viene URL absoluta, la respeta
// - Fallback visual si falla la carga (no queda “vacío”)
// - (Opcional) Debug rápido: agrega ?imgdebug=1 a la URL del POS para ver qué está llegando
// ============================================================

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/BufetUI.css";
import "../styles/VentasPOSPage.css";

import { httpGet, httpPost } from "../api/http";

import { obtenerEvento } from "../api/eventos";
import { listarProductosEvento, type ProductoEvento } from "../api/productosEvento";

import { crearVenta, type MedioPago } from "../api/ventas";
import { listarCajas, type Caja } from "../api/cajas";

type CartItem = {
  producto_evento_id: number;
  producto_id: number;
  nombre: string;
  categoria?: string | null;
  precio_unitario: number;
  cantidad: number;
  stock_actual: number;
  maneja_stock?: number | boolean;
};

const mediosPago: MedioPago[] = ["EFECTIVO", "MP_QR", "DEBITO", "CREDITO", "TRANSFERENCIA", "OTRO"];

// TIPOS compatibles con tabla caja_movimientos.tipo
// (ENUM('INGRESO_MANUAL','RETIRO'))
type MovTipo = "INGRESO_MANUAL" | "RETIRO";

type ResumenCajaSesion = {
  id: number;
  sesion_id?: number;
  caja_id: number;
  evento_id: number;
  usuario_id: number;
  estado: string;
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_inicial_efectivo: number;
  total_ventas_efectivo: number;
  total_ingresos_efectivo: number;
  total_retiros_efectivo: number;
  monto_teorico_efectivo: number;
  monto_declarado_efectivo: number | null;
  diferencia_efectivo: number | null;
};

// ✅ API base para construir URLs de imágenes (VITE_API_URL suele ser .../api)
const API = import.meta.env.VITE_API_URL;
const API_BASE = API ? String(API).replace(/\/api\/?$/, "") : "";

// ------------------------------------------------------------
// Helpers imagen
// ------------------------------------------------------------
const isAbsoluteUrl = (s: string) => /^https?:\/\//i.test(s);

const normalizeUploadPath = (raw: string) => {
  const t = raw.trim();
  if (!t) return "";

  if (isAbsoluteUrl(t)) return t;

  // si viene "C:\..." o similar, no sirve para web
  if (/^[a-zA-Z]:\\/.test(t)) return "";

  // si viene "uploads/xxx.jpg" o "uploads\xxx.jpg"
  const cleaned = t.replace(/\\/g, "/");

  // si ya tiene /uploads/
  if (cleaned.startsWith("/uploads/")) return cleaned;

  // si viene "uploads/..."
  if (cleaned.startsWith("uploads/")) return `/${cleaned}`;

  // si viene "/xxx.jpg" o "/images/xxx.jpg" lo dejamos tal cual
  if (cleaned.startsWith("/")) return cleaned;

  // si viene "xxx.jpg" (solo nombre), lo asumimos en /uploads/
  if (!cleaned.includes("/")) return `/uploads/${cleaned}`;

  // cualquier otro relativo "carpeta/archivo.jpg" -> lo dejamos como "/carpeta/archivo.jpg"
  return `/${cleaned}`;
};

const buildImgUrl = (path?: string | null) => {
  if (!path) return "";
  const normalized = normalizeUploadPath(String(path));
  if (!normalized) return "";
  if (isAbsoluteUrl(normalized)) return normalized;

  // si tenemos API_BASE (backend), armamos contra backend
  if (API_BASE) {
    return `${API_BASE}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
  }

  // fallback: mismo origen
  return normalized;
};

const pickImageField = (pe: any): string | null => {
  // Intentar varios nombres comunes sin romper nada
  const candidates = [
    pe?.imagen_url,
    pe?.producto_imagen_url,
    pe?.icono_url,
    pe?.foto_url,

    // extra: variantes típicas
    pe?.imagen,
    pe?.image_url,
    pe?.img_url,
    pe?.url_imagen,
    pe?.url_foto,
    pe?.producto_foto_url,
    pe?.producto_imagen,
    pe?.producto_img,
    pe?.producto_img_url,
    pe?.thumbnail_url,
    pe?.thumb_url,
    pe?.url,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
};

export default function VentasPOSPage() {
  const navigate = useNavigate();
  const { eventoId } = useParams();
  const evento_id = Number(eventoId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eventoNombre, setEventoNombre] = useState<string>("");
  const [organizadorId, setOrganizadorId] = useState<number | null>(null);

  const [productos, setProductos] = useState<ProductoEvento[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  const [carrito, setCarrito] = useState<CartItem[]>([]);

  // Cajas disponibles para este evento
  const [cajasEvento, setCajasEvento] = useState<Caja[]>([]);

  // Datos operativos
  const [cajaId, setCajaId] = useState<string>("");
  const [cajaSesionId, setCajaSesionId] = useState<string>("");
  const [usuarioId, setUsuarioId] = useState<string>("1");

  // Monto inicial para apertura de sesión
  const [montoInicialStr, setMontoInicialStr] = useState<string>("");
  // usar saldo del último cierre como monto inicial
  const [usarSaldoAnterior, setUsarSaldoAnterior] = useState<boolean>(false);

  // Resumen de caja (EFECTIVO)
  const [saldoCaja, setSaldoCaja] = useState<number>(0);
  const [saldoCajaLoading, setSaldoCajaLoading] = useState(false);
  const [resumenCaja, setResumenCaja] = useState<ResumenCajaSesion | null>(null);

  const [medioPago, setMedioPago] = useState<MedioPago>("EFECTIVO");
  const [referenciaPago, setReferenciaPago] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");

  const [efectivoRecibido, setEfectivoRecibido] = useState<string>("");

  // Modal movimientos de caja
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [movTipo, setMovTipo] = useState<MovTipo>("INGRESO_MANUAL");
  const [movMonto, setMovMonto] = useState<string>("");
  const [movNota, setMovNota] = useState<string>("");

  // Modal cobro
  const [cobroModalOpen, setCobroModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ✅ estado de imágenes rotas para no dejar huecos
  const [imgBroken, setImgBroken] = useState<Record<number, boolean>>({});

  // Debug opcional con querystring ?imgdebug=1
  const imgDebug = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("imgdebug") === "1";
    } catch {
      return false;
    }
  }, []);

  // ============================================================
  // ✅ FULLSCREEN REAL para POS
  // ============================================================
  useEffect(() => {
    const main = document.querySelector("main.bufet-main") as HTMLElement | null;
    if (!main) return;

    main.classList.add("bufet-main-full");
    return () => {
      main.classList.remove("bufet-main-full");
    };
  }, []);

  // ============================================================
  // ✅ Cargar datos operativos desde localStorage
  // ============================================================
  useEffect(() => {
    try {
      const caja = localStorage.getItem("bufet_caja_id") || "";
      const sesion = localStorage.getItem("bufet_caja_sesion_id") || "";
      const usuario = localStorage.getItem("bufet_usuario_id") || "1";

      setCajaId(caja);
      setCajaSesionId(sesion);
      setUsuarioId(usuario);
    } catch {
      setCajaId("");
      setCajaSesionId("");
      setUsuarioId("1");
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("bufet_caja_id", cajaId || "");
    } catch {
      //
    }
  }, [cajaId]);

  useEffect(() => {
    try {
      localStorage.setItem("bufet_caja_sesion_id", cajaSesionId || "");
    } catch {
      //
    }
  }, [cajaSesionId]);

  useEffect(() => {
    try {
      localStorage.setItem("bufet_usuario_id", usuarioId || "");
    } catch {
      //
    }
  }, [usuarioId]);

  const limpiarMensajes = () => {
    setError(null);
    setInfo(null);
  };

  const formatearMoneda = (n: number) => {
    if (!Number.isFinite(n)) return "$ 0";
    return `$ ${Math.round(n).toLocaleString("es-AR")}`;
  };

  const parseMonto = (s: string): number => {
    const clean = String(s || "").trim().replace(/\./g, "").replace(/,/g, ".");
    const v = Number(clean);
    return Number.isFinite(v) ? v : 0;
  };

  // ============================================================
  // ✅ Carga inicial de evento + productos + cajas
  // ============================================================
  const cargarTodo = async () => {
    if (!Number.isFinite(evento_id) || evento_id <= 0) {
      setError("Evento inválido en la URL.");
      return;
    }
    try {
      setLoading(true);
      limpiarMensajes();

      const ev = await obtenerEvento(evento_id);
      setEventoNombre(ev?.nombre || `Evento #${evento_id}`);
      setOrganizadorId(ev?.organizador_id ?? null);

      const rows = await listarProductosEvento({
        evento_id,
        solo_activos: true,
      });
      setProductos(Array.isArray(rows) ? rows : []);

      // Cajas del evento
      const cajas = await listarCajas({ evento_id });
      const lista = Array.isArray(cajas) ? cajas : [];
      setCajasEvento(lista);

      // Autocompletar Caja ID si hay exactamente una caja
      if (!cajaId && lista.length === 1) {
        setCajaId(String(lista[0].id));
      }

      // reset rotas (para que si arreglás en backend/DB vuelva a intentar)
      setImgBroken({});
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el POS del evento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento_id]);

  // ============================================================
  // ✅ Cargar RESUMEN de CAJA (EFECTIVO) usando httpGet
  // ============================================================
  const cargarResumenCajaSesion = async (sesionIdOptional?: number) => {
    const sesionId =
      typeof sesionIdOptional === "number" ? sesionIdOptional : Number(cajaSesionId);

    if (!Number.isFinite(sesionId) || sesionId <= 0) return;

    try {
      setSaldoCajaLoading(true);
      const data = await httpGet<ResumenCajaSesion>(`/caja-sesiones/${sesionId}/resumen`);

      setResumenCaja(data);
      const v = Number(data.monto_teorico_efectivo);
      setSaldoCaja(Number.isFinite(v) ? v : 0);
    } catch (e: any) {
      console.error("❌ Error cargarResumenCajaSesion:", e);
      setError((prev) => prev ?? (e?.message || "No se pudo actualizar la caja."));
    } finally {
      setSaldoCajaLoading(false);
    }
  };

  useEffect(() => {
    if (!cajaSesionId) return;
    const id = Number(cajaSesionId);
    if (!Number.isFinite(id) || id <= 0) return;
    cargarResumenCajaSesion(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajaSesionId]);

  // ============================================================
  // ✅ Apertura y cierre de sesión de caja (httpPost)
  // ============================================================
  const abrirSesionCaja = async () => {
    limpiarMensajes();

    const caja_id = Number(cajaId);
    const usuario_id = Number(usuarioId);

    if (!Number.isFinite(caja_id) || caja_id <= 0) {
      setError("Ingresá un ID de caja válido.");
      return;
    }

    if (!Number.isFinite(usuario_id) || usuario_id <= 0) {
      setError("Ingresá un ID de usuario válido.");
      return;
    }

    // Si se usa saldo anterior, el monto manual no se considera
    const montoInicialManual = usarSaldoAnterior ? 0 : parseMonto(montoInicialStr);

    try {
      setSaving(true);

      const payload: any = {
        caja_id,
        usuario_id,
        evento_id,
        monto_inicial_efectivo: montoInicialManual,
      };

      // pedir al backend usar el saldo del último cierre
      if (usarSaldoAnterior) {
        payload.usar_saldo_anterior = true;
      }

      const data = await httpPost<ResumenCajaSesion | any>("/caja-sesiones/apertura", payload);

      const nuevaSesionId = Number(data.id || data.sesion_id);
      if (!Number.isFinite(nuevaSesionId) || nuevaSesionId <= 0) {
        setError("Sesión de caja creada pero no se obtuvo un ID válido.");
        return;
      }

      setCajaSesionId(String(nuevaSesionId));
      setInfo("Sesión de caja abierta correctamente.");

      if (data.monto_inicial_efectivo != null) {
        const v = Number(data.monto_inicial_efectivo);
        setMontoInicialStr(Number.isFinite(v) ? String(Math.round(v)) : "");
      }

      await cargarResumenCajaSesion(nuevaSesionId);
    } catch (e: any) {
      console.error("❌ Error abrirSesionCaja:", e);
      setError(e?.message || "No se pudo abrir la sesión de caja.");
    } finally {
      setSaving(false);
    }
  };

  const cerrarSesionCaja = async () => {
    limpiarMensajes();

    const sesionIdNum = Number(cajaSesionId);
    if (!Number.isFinite(sesionIdNum) || sesionIdNum <= 0) {
      setError("No hay sesión de caja abierta para cerrar.");
      return;
    }

    const defaultValor =
      saldoCaja && Number.isFinite(saldoCaja) ? String(Math.round(saldoCaja)) : "";
    const input = window.prompt("Monto declarado en EFECTIVO al cierre de la caja:", defaultValor);
    if (input === null) return;

    const montoDeclarado = parseMonto(input);
    if (!Number.isFinite(montoDeclarado) || montoDeclarado < 0) {
      setError("Ingresá un monto declarado válido.");
      return;
    }

    try {
      setSaving(true);

      const data = await httpPost<any>(`/caja-sesiones/${sesionIdNum}/cierre`, {
        monto_declarado_efectivo: montoDeclarado,
      });

      setInfo("Sesión de caja cerrada correctamente.");
      setResumenCaja((prev) => ({
        ...(prev || ({} as ResumenCajaSesion)),
        ...data,
      }));

      const nuevoTeorico = Number(
        data.monto_teorico_efectivo ??
          (data.resumen_calculo ? data.resumen_calculo.montoTeorico : saldoCaja)
      );
      setSaldoCaja(Number.isFinite(nuevoTeorico) ? nuevoTeorico : 0);

      setCajaSesionId("");
      setMontoInicialStr("");
      setUsarSaldoAnterior(false);
    } catch (e: any) {
      console.error("❌ Error cerrarSesionCaja:", e);
      setError(e?.message || "No se pudo cerrar la sesión de caja.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // ✅ Lógica de catálogo / carrito
  // ============================================================
  const categorias = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p: any) => {
      const cat = String(p.categoria || "Sin categoría").trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    if (!categoriaFiltro) return productos;
    return productos.filter((p: any) => {
      const cat = String(p.categoria || "Sin categoría");
      return cat === categoriaFiltro;
    });
  }, [productos, categoriaFiltro]);

  const total = useMemo(() => carrito.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0), [carrito]);

  const efectivoRecibidoNum = useMemo(() => parseMonto(efectivoRecibido), [efectivoRecibido]);

  const vuelto = useMemo(() => {
    if (medioPago !== "EFECTIVO") return 0;
    const v = efectivoRecibidoNum - total;
    return Number.isFinite(v) ? v : 0;
  }, [medioPago, efectivoRecibidoNum, total]);

  const faltaEfectivo = useMemo(() => {
    if (medioPago !== "EFECTIVO") return false;
    if (!carrito.length) return false;
    return efectivoRecibidoNum < total;
  }, [medioPago, efectivoRecibidoNum, total, carrito.length]);

  const agregarAlCarrito = (pe: ProductoEvento) => {
    limpiarMensajes();

    const peId = Number((pe as any).id);
    const nombre = String((pe as any).producto_nombre || "Producto");
    const producto_id = Number((pe as any).producto_id);
    const precio = Number((pe as any).precio_venta);
    const stock_actual = Number((pe as any).stock_actual ?? 0);
    const categoria = (pe as any).categoria ?? null;

    if (!Number.isFinite(peId) || peId <= 0) return;

    setCarrito((prev) => {
      const maneja = Boolean((pe as any).maneja_stock) || Number((pe as any).maneja_stock) === 1;

      const idx = prev.findIndex((x) => x.producto_evento_id === peId);

      if (idx >= 0) {
        const copia = [...prev];
        const actual = copia[idx];

        if (maneja && actual.cantidad + 1 > stock_actual) {
          setError(`Stock insuficiente para '${nombre}'. Disponible: ${stock_actual}`);
          return prev;
        }

        copia[idx] = { ...actual, cantidad: actual.cantidad + 1 };
        return copia;
      }

      if (maneja && stock_actual < 1) {
        setError(`Sin stock para '${nombre}'.`);
        return prev;
      }

      return [
        ...prev,
        {
          producto_evento_id: peId,
          producto_id,
          nombre,
          categoria,
          precio_unitario: Number.isFinite(precio) ? precio : 0,
          cantidad: 1,
          stock_actual: Number.isFinite(stock_actual) ? stock_actual : 0,
          maneja_stock: (pe as any).maneja_stock ?? 0,
        },
      ];
    });
  };

  const setCantidad = (producto_evento_id: number, nueva: number) => {
    setCarrito((prev) => {
      const copia = prev.map((it) => ({ ...it }));
      const idx = copia.findIndex((x) => x.producto_evento_id === producto_evento_id);
      if (idx < 0) return prev;

      const it = copia[idx];
      const cant = Math.max(0, Math.trunc(nueva));
      const maneja = Boolean(it.maneja_stock) || Number(it.maneja_stock) === 1;

      if (maneja && cant > it.stock_actual) {
        setError(`Stock insuficiente para '${it.nombre}'. Disponible: ${it.stock_actual}`);
        return prev;
      }

      if (cant === 0) {
        return copia.filter((x) => x.producto_evento_id !== producto_evento_id);
      }

      copia[idx] = { ...it, cantidad: cant };
      return copia;
    });
  };

  const inc = (id: number) => {
    const it = carrito.find((x) => x.producto_evento_id === id);
    if (!it) return;
    setCantidad(id, it.cantidad + 1);
  };

  const dec = (id: number) => {
    const it = carrito.find((x) => x.producto_evento_id === id);
    if (!it) return;
    setCantidad(id, it.cantidad - 1);
  };

  const vaciarCarrito = () => {
    setCarrito([]);
    setReferenciaPago("");
    setObservaciones("");
    setMedioPago("EFECTIVO");
    setEfectivoRecibido("");
    setInfo("Carrito limpio.");
    setError(null);
  };

  const confirmarVenta = async () => {
    limpiarMensajes();

    const caja_id = Number(cajaId);
    const caja_sesion_id = Number(cajaSesionId);
    const usuario_id = Number(usuarioId);

    if (!evento_id) {
      setError("Evento inválido.");
      return;
    }

    if (!Number.isFinite(caja_id) || caja_id <= 0) {
      setError("Ingresá un ID de caja válido.");
      return;
    }

    if (!Number.isFinite(caja_sesion_id) || caja_sesion_id <= 0) {
      setError("Debés abrir una sesión de caja antes de registrar ventas.");
      return;
    }

    if (!Number.isFinite(usuario_id) || usuario_id <= 0) {
      setError("Ingresá un ID de usuario válido.");
      return;
    }

    if (!carrito.length) {
      setError("El carrito está vacío.");
      return;
    }

    if (carrito.some((x) => !Number.isFinite(x.precio_unitario) || x.precio_unitario <= 0)) {
      setError("Hay un producto con precio inválido. Revisá configuración del evento.");
      return;
    }

    if (medioPago === "EFECTIVO" && faltaEfectivo) {
      setError("En efectivo: el importe recibido es menor al total.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        evento_id,
        caja_id,
        caja_sesion_id,
        usuario_id,
        medio_pago: medioPago,
        referencia_pago: referenciaPago ? referenciaPago.trim() : null,
        observaciones: observaciones ? observaciones.trim() : null,
        items: carrito.map((it) => ({
          producto_evento_id: it.producto_evento_id,
          cantidad: it.cantidad,
        })),
      };

      const r = await crearVenta(payload);
      setInfo(`Venta registrada (ID: ${r?.id}).`);

      if (medioPago === "EFECTIVO") {
        await cargarResumenCajaSesion(caja_sesion_id);
      }

      setCarrito([]);
      setReferenciaPago("");
      setObservaciones("");
      setEfectivoRecibido("");

      setCobroModalOpen(false);
      await cargarTodo();
    } catch (e: any) {
      setError(e?.message || "No se pudo registrar la venta.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Movimientos de caja (Ingreso / Egreso manual) via httpPost
  // ============================================================
  const abrirMovModal = (tipo: MovTipo) => {
    limpiarMensajes();
    setMovTipo(tipo);
    setMovMonto("");
    setMovNota("");
    setMovModalOpen(true);
  };

  const cerrarMovModal = () => {
    setMovModalOpen(false);
  };

  const confirmarMovModal = async () => {
    limpiarMensajes();
    const monto = parseMonto(movMonto);

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Movimiento: ingresá un monto válido (> 0).");
      return;
    }

    const caja_sesion_id = Number(cajaSesionId);
    if (!Number.isFinite(caja_sesion_id) || caja_sesion_id <= 0) {
      setError("No hay sesión de caja válida. Abrí una sesión antes de registrar movimientos.");
      return;
    }

    const label = movTipo === "INGRESO_MANUAL" ? "Ingreso de efectivo" : "Egreso de efectivo";

    try {
      setSaving(true);

      const payload = {
        caja_sesion_id,
        tipo: movTipo,
        medio: "EFECTIVO",
        monto,
        descripcion: movNota ? movNota.trim() : null,
      };

      await httpPost("/caja-movimientos", payload);

      setInfo(`${label} registrado: ${formatearMoneda(monto)}${movNota ? ` · Nota: ${movNota}` : ""}`);
      setMovModalOpen(false);

      await cargarResumenCajaSesion(caja_sesion_id);
    } catch (e: any) {
      setError(e?.message || "No se pudo registrar el movimiento de caja.");
    } finally {
      setSaving(false);
    }
  };

  const onModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setMovModalOpen(false);
      setCobroModalOpen(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="bufet-pos pos-shell">
      {/* Header superior */}
      <div className="pos-header">
        <div className="pos-header-left">
          <div className="pos-title">POS · Ventas</div>
          <div className="pos-subtitle">
            Evento: <strong>{eventoNombre}</strong> <span className="pos-dim">(ID {evento_id})</span>
            {organizadorId ? <span className="pos-dim"> · Organizador {organizadorId}</span> : null}
          </div>
          {imgDebug && (
            <div className="pos-dim" style={{ fontSize: "0.75rem", marginTop: 2 }}>
              imgdebug=1 · API_BASE: <strong>{API_BASE || "(vacío)"}</strong>
            </div>
          )}
        </div>

        <div className="pos-header-actions">
          <button className="btn-secondary pos-btn" type="button" onClick={() => navigate("/eventos")} disabled={saving}>
            Volver
          </button>

          <button
            className="btn-secondary pos-btn"
            type="button"
            onClick={async () => {
              await cargarTodo();
              await cargarResumenCajaSesion();
            }}
            disabled={loading || saving}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {(error || info) && (
        <div className="pos-messages">
          {error && <div className="bufet-error">{error}</div>}
          {info && <div className="bufet-info">{info}</div>}
        </div>
      )}

      {/* Top cards 50/50 */}
      <div className="pos-topcards">
        {/* Datos operativos (COMPACTO 1 FILA) */}
        <div className="pos-topcard pos-topcard-ops pos-topcard-ops-compact">
          <div className="pos-topcard-row pos-topcard-row-compact">
            <div className="pos-topcard-title pos-topcard-title-compact">Datos operativos</div>

            <div className="pos-ops-inline pos-ops-inline-compact">
              <div className="pos-ops-field pos-ops-field-compact">
                <input
                  className="bufet-input pos-ops-input-compact"
                  style={{ width: "5.2rem" }}
                  inputMode="numeric"
                  placeholder="Caja"
                  value={cajaId}
                  onChange={(e) => setCajaId(e.target.value)}
                  disabled={saving}
                  list="cajasEvento"
                />
                <datalist id="cajasEvento">
                  {cajasEvento.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre ? `${c.id} - ${c.nombre}` : String(c.id)}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="pos-ops-field pos-ops-field-compact">
                <input
                  className="bufet-input pos-ops-input-compact"
                  style={{ width: "5.2rem" }}
                  inputMode="numeric"
                  placeholder="Usuario"
                  value={usuarioId}
                  onChange={(e) => setUsuarioId(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="pos-ops-field pos-ops-field-compact">
                <input className="bufet-input pos-ops-input-compact" style={{ width: "7rem" }} value={cajaSesionId ? `Sesión ${cajaSesionId}` : "Sin sesión"} readOnly />
              </div>

              {/* Mantengo el monto inicial + checkbox, pero COMPACTO */}
              <div className="pos-ops-field pos-ops-field-compact">
                <input
                  className="bufet-input pos-ops-input-compact"
                  style={{ width: "7.2rem" }}
                  inputMode="numeric"
                  placeholder="Inicial $"
                  value={montoInicialStr}
                  onChange={(e) => setMontoInicialStr(e.target.value)}
                  disabled={saving || !!cajaSesionId || usarSaldoAnterior}
                  title="Monto inicial (EFECTIVO)"
                />
              </div>

              <div className="pos-ops-field pos-ops-field-compact">
                <label className="pos-ops-check-compact" title="Usar saldo anterior">
                  <input
                    type="checkbox"
                    checked={usarSaldoAnterior}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUsarSaldoAnterior(checked);
                      if (checked) setMontoInicialStr("");
                    }}
                    disabled={saving || !!cajaSesionId}
                  />
                  <span>Arrastre</span>
                </label>
              </div>

              <div className="pos-ops-actions pos-ops-actions-compact">
                {!cajaSesionId ? (
                  <button
                    className="btn-primary pos-btn pos-btn-primary pos-btn-compact"
                    type="button"
                    onClick={abrirSesionCaja}
                    disabled={saving}
                    title="Abrir sesión de caja"
                  >
                    Abrir
                  </button>
                ) : (
                  <button className="btn-danger pos-btn pos-btn-compact" type="button" onClick={cerrarSesionCaja} disabled={saving} title="Cerrar sesión de caja">
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Caja */}
        <div className="pos-topcard pos-topcard-caja">
          <div className="pos-topcard-row">
            <div className="pos-topcard-title">Caja</div>

            <div className="pos-kpi">
              <div className="pos-kpi-label">Saldo caja (EFECTIVO)</div>
              <div className="pos-kpi-value">{saldoCajaLoading ? "Actualizando..." : formatearMoneda(saldoCaja)}</div>
            </div>

            <div className="pos-caja-actions pos-caja-actions-inline">
              <button className="btn-secondary pos-btn pos-btn-soft" type="button" onClick={() => abrirMovModal("INGRESO_MANUAL")} disabled={saving}>
                Ingreso
              </button>
              <button className="btn-secondary pos-btn pos-btn-soft" type="button" onClick={() => abrirMovModal("RETIRO")} disabled={saving}>
                Egreso
              </button>
            </div>
          </div>

          {resumenCaja && (
            <div className="bufet-card-caption" style={{ marginTop: 4, fontSize: "0.75rem", lineHeight: 1.4 }}>
              Inicial: {formatearMoneda(resumenCaja.monto_inicial_efectivo)} · Ventas EF: {formatearMoneda(resumenCaja.total_ventas_efectivo)} · Ingresos:{" "}
              {formatearMoneda(resumenCaja.total_ingresos_efectivo)} · Retiros: {formatearMoneda(resumenCaja.total_retiros_efectivo)}
            </div>
          )}
        </div>
      </div>

      {/* Layout Catálogo + Carrito */}
      <div className="pos-layout">
        {/* Catálogo */}
        <div className="bufet-card-table pos-panel pos-catalog">
          <div className="pos-panel-header">
            <div>
              <div className="bufet-card-title">Catálogo</div>
              <div className="bufet-card-caption">Elegí una categoría o tocá el producto para agregarlo al carrito.</div>
            </div>

            <div className="pos-categories">
              {categorias.length > 0 && (
                <>
                  <button
                    type="button"
                    className={categoriaFiltro === null ? "pos-category-btn active" : "pos-category-btn"}
                    onClick={() => setCategoriaFiltro(null)}
                  >
                    Todos
                  </button>
                  {categorias.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={categoriaFiltro === cat ? "pos-category-btn active" : "pos-category-btn"}
                      onClick={() => setCategoriaFiltro((prev) => (prev === cat ? null : cat))}
                    >
                      {cat}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="pos-catalog-grid">
            {loading ? (
              <div className="pos-catalog-empty">Cargando productos...</div>
            ) : productosFiltrados.length === 0 ? (
              <div className="pos-catalog-empty">No hay productos activos configurados para este evento.</div>
            ) : (
              productosFiltrados.map((pe: any) => {
                const maneja = Boolean(pe.maneja_stock) || Number(pe.maneja_stock) === 1;
                const stock = Number(pe.stock_actual ?? 0);
                const sinStock = maneja && stock <= 0;

                const clickable = !sinStock && !saving;

                const rawImg = pickImageField(pe);
                const imgSrc = rawImg ? buildImgUrl(rawImg) : "";
                const pid = Number(pe.id || 0);
                const broken = pid > 0 ? Boolean(imgBroken[pid]) : false;

                const mostrarImg = Boolean(imgSrc) && !broken;

                return (
                  <div
                    key={pe.id}
                    className={`pos-card ${sinStock ? "muted" : ""} ${clickable ? "clickable" : ""}`}
                    role={clickable ? "button" : "group"}
                    tabIndex={clickable ? 0 : -1}
                    onClick={() => {
                      if (!clickable) return;
                      agregarAlCarrito(pe);
                    }}
                    onKeyDown={(e) => {
                      if (!clickable) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        agregarAlCarrito(pe);
                      }
                    }}
                    title={sinStock ? "Sin stock" : "Click para agregar"}
                  >
                    {/* ✅ IMAGEN (tamaño físico 2cm x 2cm, dentro del “botón” 4cm x 2cm) */}
                    <div className={`pos-card-img ${!mostrarImg ? "pos-card-img-empty" : ""}`}>
                      {mostrarImg ? (
                        <img
                          src={imgSrc}
                          alt={String(pe.producto_nombre || "Producto")}
                          loading="lazy"
                          onError={() => {
                            if (pid > 0) {
                              setImgBroken((prev) => ({ ...prev, [pid]: true }));
                            }
                            if (imgDebug) {
                              // eslint-disable-next-line no-console
                              console.log("IMG ERROR", { producto_evento_id: pid, rawImg, imgSrc, pe });
                            }
                          }}
                        />
                      ) : (
                        <div className="pos-card-img-fallback">
                          <div>Sin</div>
                          <div>imagen</div>
                          {imgDebug && (
                            <div className="pos-card-img-debug">
                              <div>raw: {rawImg ? String(rawImg) : "(null)"}</div>
                              <div>src: {imgSrc ? String(imgSrc) : "(vacío)"}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pos-card-name" title={pe.producto_nombre}>
                      {pe.producto_nombre}
                    </div>

                    <div className="pos-card-meta">
                      <span className="pos-chip">{pe.categoria || "Sin categoría"}</span>
                    </div>

                    <div className="pos-card-kpis">
                      <div className="pos-card-price">{formatearMoneda(Number(pe.precio_venta || 0))}</div>
                      <div className="pos-card-stock">{maneja ? `Stock: ${stock}` : "Stock: —"}</div>
                    </div>

                    <div className="pos-card-hint">{sinStock ? "Sin stock" : "Tocá"}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Carrito */}
        <div className="bufet-card-form pos-panel pos-cart">
          <div className="pos-cart-top">
            <div>
              <div className="bufet-card-title">Carrito</div>
              <div className="bufet-card-caption">
                Items: <strong>{carrito.length}</strong>
              </div>
            </div>
            <div className="pos-total-box">
              <div className="pos-total-label">TOTAL</div>
              <div className="pos-total-value">{formatearMoneda(total)}</div>
            </div>
          </div>

          <div className="pos-cart-body">
            <div className="pos-cart-items">
              {!carrito.length ? (
                <div className="bufet-subtitle">Agregá productos desde el catálogo.</div>
              ) : (
                carrito.map((it) => (
                  <div key={it.producto_evento_id} className="pos-item">
                    <div className="pos-item-left">
                      <div className="pos-item-name">{it.nombre}</div>
                      <div className="pos-item-meta">
                        <span className="pos-chip">{it.categoria || "Sin categoría"}</span>
                        <span className="pos-item-unit">{formatearMoneda(it.precio_unitario)} c/u</span>
                      </div>
                      {(Boolean(it.maneja_stock) || Number(it.maneja_stock) === 1) && <div className="pos-stock">Stock: {it.stock_actual}</div>}
                    </div>

                    <div className="pos-item-mid">
                      <div className="pos-qty">
                        <button className="btn-secondary pos-btn pos-qty-btn" type="button" onClick={() => dec(it.producto_evento_id)} disabled={saving} aria-label="Restar">
                          −
                        </button>
                        <input
                          className="bufet-input pos-qty-input"
                          inputMode="numeric"
                          value={String(it.cantidad)}
                          onChange={(e) => setCantidad(it.producto_evento_id, Number(e.target.value))}
                          disabled={saving}
                        />
                        <button className="btn-secondary pos-btn pos-qty-btn" type="button" onClick={() => inc(it.producto_evento_id)} disabled={saving} aria-label="Sumar">
                          +
                        </button>
                      </div>
                      <button className="btn-ghost pos-btn pos-remove" type="button" onClick={() => setCantidad(it.producto_evento_id, 0)} disabled={saving}>
                        Quitar
                      </button>
                    </div>

                    <div className="pos-item-right">
                      <div className="pos-subtotal-label">Subtotal</div>
                      <div className="pos-subtotal">{formatearMoneda(it.precio_unitario * it.cantidad)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pos-cart-footer">
              <div className="pos-actions">
                <button
                  className="btn-primary pos-btn pos-btn-primary pos-confirm"
                  type="button"
                  onClick={() => {
                    limpiarMensajes();
                    setCobroModalOpen(true);
                  }}
                  disabled={saving || !carrito.length}
                  title={!carrito.length ? "Carrito vacío" : "Abrir cobro"}
                >
                  Cobrar / Confirmar venta
                </button>

                <button className="btn-secondary pos-btn" type="button" onClick={vaciarCarrito} disabled={saving}>
                  Vaciar carrito
                </button>

                <div className="pos-inline-hint">
                  <span className="pos-hint">La forma de cobro se define al confirmar la venta.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL MOVIMIENTOS DE CAJA */}
      {movModalOpen && (
        <div className="pos-modal-overlay" onKeyDown={onModalKeyDown} tabIndex={-1} role="dialog" aria-modal="true">
          <div className="pos-modal">
            <div className="pos-modal-header">
              <div className="pos-modal-title">{movTipo === "INGRESO_MANUAL" ? "Ingreso de efectivo" : "Egreso de efectivo"}</div>
              <button className="btn-ghost pos-btn" type="button" onClick={cerrarMovModal}>
                Cerrar
              </button>
            </div>

            <div className="pos-modal-body">
              <div className="bufet-field">
                <div className="bufet-label">Monto *</div>
                <input
                  className="bufet-input"
                  inputMode="numeric"
                  value={movMonto}
                  onChange={(e) => setMovMonto(e.target.value)}
                  placeholder="Ej: 10000"
                  autoFocus
                  disabled={saving}
                />
              </div>

              <div className="bufet-field">
                <div className="bufet-label">Nota (opcional)</div>
                <input
                  className="bufet-input"
                  value={movNota}
                  onChange={(e) => setMovNota(e.target.value)}
                  placeholder="Ej: cambio / retiro por seguridad..."
                  disabled={saving}
                />
              </div>

              <div className="pos-modal-actions">
                <button className="btn-secondary pos-btn" type="button" onClick={cerrarMovModal} disabled={saving}>
                  Cancelar
                </button>
                <button className="btn-primary pos-btn pos-btn-primary" type="button" onClick={confirmarMovModal} disabled={saving}>
                  Confirmar
                </button>
              </div>

              <div className="bufet-card-caption" style={{ marginTop: 8 }}>
                Tecla: <strong>Esc</strong> para cerrar.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRO / CONFIRMAR VENTA */}
      {cobroModalOpen && (
        <div className="pos-modal-overlay pos-modal-overlay-cobro" onKeyDown={onModalKeyDown} tabIndex={-1} role="dialog" aria-modal="true">
          <div className="pos-modal pos-modal-cobro">
            <div className="pos-modal-header">
              <div className="pos-modal-title">Cobro de venta</div>
              <button className="btn-ghost pos-btn" type="button" onClick={() => setCobroModalOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="pos-modal-body">
              <div className="pos-section-title">Total a cobrar: {formatearMoneda(total)}</div>

              <div className="pos-grid-2">
                <div className="bufet-field">
                  <div className="bufet-label">Medio de pago</div>
                  <select
                    className="bufet-select"
                    value={medioPago}
                    onChange={(e) => {
                      const v = e.target.value as MedioPago;
                      setMedioPago(v);
                      if (v !== "EFECTIVO") setEfectivoRecibido("");
                    }}
                    disabled={saving}
                  >
                    {mediosPago.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bufet-field">
                  <div className="bufet-label">Referencia (opcional)</div>
                  <input
                    className="bufet-input"
                    value={referenciaPago}
                    onChange={(e) => setReferenciaPago(e.target.value)}
                    placeholder="N° operación / comprobante..."
                    disabled={saving}
                  />
                </div>
              </div>

              {medioPago === "EFECTIVO" && (
                <div className="pos-cashbox">
                  <div className="pos-grid-2">
                    <div className="bufet-field">
                      <div className="bufet-label">Me dio</div>
                      <input
                        className="bufet-input"
                        inputMode="numeric"
                        value={efectivoRecibido}
                        onChange={(e) => setEfectivoRecibido(e.target.value)}
                        placeholder="Ej: 5000"
                        disabled={saving}
                      />
                    </div>

                    <div className="pos-change">
                      <div className="pos-change-label">Vuelto</div>
                      <div className={`pos-change-value ${faltaEfectivo ? "bad" : "ok"}`}>{formatearMoneda(vuelto)}</div>
                      {faltaEfectivo && <div className="pos-change-hint">Falta efectivo para confirmar.</div>}
                    </div>
                  </div>
                </div>
              )}

              <div className="bufet-field">
                <div className="bufet-label">Observaciones (opcional)</div>
                <input
                  className="bufet-input"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Descuento, promo, nota..."
                  disabled={saving}
                />
              </div>

              <div className="pos-modal-actions">
                <button className="btn-secondary pos-btn" type="button" onClick={() => setCobroModalOpen(false)} disabled={saving}>
                  Cancelar
                </button>
                <button
                  className="btn-primary pos-btn pos-btn-primary"
                  type="button"
                  onClick={confirmarVenta}
                  disabled={saving || !carrito.length || (medioPago === "EFECTIVO" && faltaEfectivo)}
                  title={medioPago === "EFECTIVO" && faltaEfectivo ? "Falta efectivo para confirmar" : "Confirmar venta"}
                >
                  {saving ? "Registrando..." : "Confirmar venta"}
                </button>
              </div>

              <div className="bufet-card-caption" style={{ marginTop: 8 }}>
                Tecla: <strong>Esc</strong> para cerrar.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
