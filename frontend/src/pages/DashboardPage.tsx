// src/pages/DashboardPage.tsx
// ============================================================
// 🏠 DASHBOARD PRINCIPAL BUFET_DOE
// - Accesos rápidos a módulos implementados
// - Mantiene diseño y estructura original
// ============================================================

import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <>
      <section className="bufet-dashboard-header">
        <div className="bufet-dashboard-title">Panel de control</div>
        <div className="bufet-dashboard-subtitle">
          Organizá un evento, definí productos y cajas, abrí sesiones de caja
          y registrá ventas por subcomisión en una red local.
        </div>
      </section>

      <section className="bufet-dashboard-grid">
        <div className="bufet-card">
          <div className="bufet-card-header">
            <div>
              <div className="bufet-card-title">Accesos rápidos</div>
              <div className="bufet-card-caption">
                Empezá por configurar la base del evento, luego cajas y sesiones
                de caja para operar el POS.
              </div>
            </div>
          </div>

          <div className="bufet-quick-grid">
            {/* Organizadores */}
            <button
              type="button"
              className="bufet-quick-card"
              onClick={() => navigate("/organizadores")}
            >
              <div className="bufet-quick-title">Organizadores</div>
              <div className="bufet-quick-desc">
                Alta de clubes, escuelas u otros organizadores del evento bufet.
              </div>
              <div className="bufet-quick-tag">
                <span className="bufet-quick-tag-dot" />
                Base del sistema
              </div>
            </button>

            {/* Subcomisiones */}
            <button
              type="button"
              className="bufet-quick-card"
              onClick={() => navigate("/subcomisiones")}
            >
              <div className="bufet-quick-title">Subcomisiones</div>
              <div className="bufet-quick-desc">
                Fútbol, hockey, básquet, vóley, cooperadora, etc.
              </div>
              <div className="bufet-quick-tag">
                <span className="bufet-quick-tag-dot" />
                Reparte la recaudación
              </div>
            </button>

            {/* Productos */}
            <button
              type="button"
              className="bufet-quick-card"
              onClick={() => navigate("/productos")}
            >
              <div className="bufet-quick-title">Productos</div>
              <div className="bufet-quick-desc">
                Cargá comidas, bebidas y combos disponibles en el bufet.
              </div>
              <div className="bufet-quick-tag">
                <span className="bufet-quick-tag-dot" />
                Stock y precios
              </div>
            </button>

            {/* Eventos */}
            <button
              type="button"
              className="bufet-quick-card"
              onClick={() => navigate("/eventos")}
            >
              <div className="bufet-quick-title">Eventos</div>
              <div className="bufet-quick-desc">
                Creá el evento, definí fechas y asociá productos al día de venta.
              </div>
              <div className="bufet-quick-tag">
                <span className="bufet-quick-tag-dot" />
                Día del evento
              </div>
            </button>

            {/* Cajas */}
            <button
              type="button"
              className="bufet-quick-card"
              onClick={() => navigate("/cajas")}
            >
              <div className="bufet-quick-title">Cajas y sesiones</div>
              <div className="bufet-quick-desc">
                Definí cajas por evento y abrí/cerrá sesiones de caja por PC o
                punto de venta.
              </div>
              <div className="bufet-quick-tag">
                <span className="bufet-quick-tag-dot" />
                Operación POS
              </div>
            </button>

            {/* Liquidación (placeholder) */}
            <button
              type="button"
              className="bufet-quick-card"
              onClick={() => {
                alert(
                  "Módulo Liquidación / Reportes todavía no implementado en frontend."
                );
              }}
            >
              <div className="bufet-quick-title">Liquidación</div>
              <div className="bufet-quick-desc">
                Reportes por subcomisión y medio de pago para cerrar el evento.
              </div>
              <div className="bufet-quick-tag">
                <span className="bufet-quick-tag-dot" />
                Tesorería
              </div>
            </button>
          </div>
        </div>

        <aside className="bufet-side-panel">
          <div className="bufet-side-title">Flujo sugerido</div>
          <div className="bufet-side-text">
            1) Cargá el <strong>organizador</strong> (ej. CAF, escuela). <br />
            2) Definí las <strong>subcomisiones</strong> (fútbol, hockey,
            etc.). <br />
            3) Cargá <strong>productos</strong> y asignales una subcomisión.{" "}
            <br />
            4) Creá un <strong>evento</strong> y asociá los productos que se
            venderán ese día. <br />
            5) En <strong>Cajas</strong>, definí las cajas del evento y abrí una{" "}
            <strong>sesión de caja</strong> por cada PC o punto de venta. <br />
            6) Usá el <strong>POS de ventas</strong> por evento para registrar
            todas las operaciones. <br />
            7) Al finalizar, cerrá las sesiones de caja y generá la{" "}
            <strong>liquidación</strong> por subcomisión y medio de pago.
          </div>
        </aside>
      </section>
    </>
  );
}
