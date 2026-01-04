// src/App.tsx
// ============================================================
// 🌐 APP PRINCIPAL BUFET_DOE
// ============================================================

import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./styles/BufetUI.css";

import DashboardPage from "./pages/DashboardPage";
import OrganizadoresPage from "./pages/OrganizadoresPage";
import SubcomisionesPage from "./pages/SubcomisionesPage";
import EventosPage from "./pages/EventosPage";
import ProductosPage from "./pages/ProductosPage";
import ProductosEventoPage from "./pages/ProductosEventoPage";
import VentasPOSPage from "./pages/VentasPOSPage";
import CajasPage from "./pages/CajasPage";

type Theme = "light" | "dark";

function useBufetTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("bufet-theme");
    if (stored === "light" || stored === "dark") return stored;
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(`theme-${theme}`);
    window.localStorage.setItem("bufet-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));
  return [theme, toggleTheme];
}

function Topbar(props: { theme: Theme; onToggleTheme: () => void }) {
  const { theme, onToggleTheme } = props;
  const navigate = useNavigate();

  return (
    <header className="bufet-topbar">
      <div className="bufet-topbar-inner">
        <div className="bufet-topbar-left">
          <div
            className="bufet-logo-circle"
            onClick={() => navigate("/")}
            style={{ cursor: "pointer" }}
          >
            BF
          </div>
          <div>
            <div className="bufet-topbar-text-title">BUFET Digital</div>
            <div className="bufet-topbar-text-subtitle">
              Panel local de ventas para eventos (CAF / escuelas / terceros)
            </div>
          </div>
        </div>

        <div className="bufet-topbar-right">
          <div className="bufet-pill">Evento LAN / Red local</div>
          <button
            type="button"
            className="bufet-theme-toggle"
            onClick={onToggleTheme}
          >
            <span>{theme === "light" ? "Modo oscuro" : "Modo claro"}</span>
            <div className="bufet-theme-toggle-knob" />
          </button>
        </div>
      </div>
    </header>
  );
}

function BufetNav() {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: "0.25rem 0.7rem",
    borderRadius: 999,
    border: "1px solid transparent",
    textDecoration: "none",
    color: "inherit",
    background: isActive ? "rgba(56, 189, 248, 0.16)" : "transparent",
    borderColor: isActive
      ? "rgba(56, 189, 248, 0.8)"
      : "rgba(148, 163, 184, 0.4)",
  });

  return (
    <nav
      style={{
        display: "flex",
        gap: "0.4rem",
        fontSize: "0.78rem",
        marginBottom: "0.4rem",
        flexWrap: "wrap",
      }}
    >
      <NavLink to="/" end style={linkStyle}>
        Inicio
      </NavLink>
      <NavLink to="/organizadores" style={linkStyle}>
        Organizadores
      </NavLink>
      <NavLink to="/subcomisiones" style={linkStyle}>
        Subcomisiones
      </NavLink>
      <NavLink to="/productos" style={linkStyle}>
        Productos
      </NavLink>
      <NavLink to="/eventos" style={linkStyle}>
        Eventos
      </NavLink>
      {/* ✅ Nuevo módulo de cajas */}
      <NavLink to="/cajas" style={linkStyle}>
        Cajas
      </NavLink>
    </nav>
  );
}

function AppShell(props: { theme: Theme; toggleTheme: () => void }) {
  const { theme, toggleTheme } = props;
  const location = useLocation();

  const isFullscreen = useMemo(() => {
    const p = location.pathname;

    // ✅ Fullscreen para pantallas operativas del evento
    // /eventos/:id/productos  y  /eventos/:id/ventas
    if (
      p.startsWith("/eventos/") &&
      (p.includes("/productos") || p.includes("/ventas"))
    ) {
      return true;
    }

    return false;
  }, [location.pathname]);

  return (
    <div className="bufet-app">
      <Topbar theme={theme} onToggleTheme={toggleTheme} />

      <main className={`bufet-main ${isFullscreen ? "bufet-main-full" : ""}`}>
        <BufetNav />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/organizadores" element={<OrganizadoresPage />} />
          <Route path="/subcomisiones" element={<SubcomisionesPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/eventos" element={<EventosPage />} />
          <Route
            path="/eventos/:eventoId/productos"
            element={<ProductosEventoPage />}
          />
          <Route path="/eventos/:eventoId/ventas" element={<VentasPOSPage />} />
          {/* ✅ Ruta de Cajas */}
          <Route path="/cajas" element={<CajasPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [theme, toggleTheme] = useBufetTheme();

  return (
    <BrowserRouter>
      <AppShell theme={theme} toggleTheme={toggleTheme} />
    </BrowserRouter>
  );
}
