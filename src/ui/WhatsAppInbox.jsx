// frontend/src/pages/WhatsAppAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props esperadas:
 *   - api: (path, opts?) => Promise<any>
 *   - brands: array [{id,name}]
 *   - brandId: number | null
 *   - setBrandId: fn
 */
export default function WhatsAppAdmin({ api, brands, brandId, setBrandId }) {
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState(null);       // /api/wa/config
  const [qrInfo, setQrInfo] = useState(null); // /api/wa/qr
  const [log, setLog] = useState([]);
  const [to, setTo] = useState("");
  const [txt, setTxt] = useState("Hola! Prueba desde Gestión WhatsApp");
  const pollRef = useRef(null);

  const selectedBrand = useMemo(
    () => (brands || []).find((b) => b.id === brandId) || null,
    [brands, brandId]
  );

  function addLog(line) {
    setLog((prev) => [String(line), ...prev].slice(0, 200));
  }

  async function loadConfig(currBrandId = brandId) {
    if (!currBrandId) return;
    try {
      const data = await api(`/api/wa/config?brand_id=${currBrandId}`);
      setCfg(data);
      addLog(`Config cargada para brand ${currBrandId} (instancia: ${data?.instance_name || `brand_${currBrandId}`})`);
    } catch (e) {
      addLog(`Error cargando config: ${e.message || e}`);
    }
  }

  async function fetchQR(currBrandId = brandId) {
    if (!currBrandId) return;
    try {
      const data = await api(`/api/wa/qr?brand_id=${currBrandId}`);
      setQrInfo(data);
      return data;
    } catch (e) {
      addLog(`Error QR: ${e.message || e}`);
      return null;
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollUntilConnected(timeoutMs = 120_000, everyMs = 2000) {
    stopPolling();
    const startedAt = Date.now();
    // Primera lectura inmediata:
    const first = await fetchQR();
    if (first?.connected) {
      addLog("✅ Conectado");
      return true;
    }
    // Intervalo
    pollRef.current = setInterval(async () => {
      const info = await fetchQR();
      if (info?.connected) {
        addLog("✅ Conectado");
        stopPolling();
      } else if (Date.now() - startedAt > timeoutMs) {
        addLog("⏱️ Timeout esperando conexión");
        stopPolling();
      }
    }, everyMs);
  }

  async function onStart() {
    if (!brandId) return;
    setLoading(true);
    try {
      const res = await api(`/api/wa/start?brand_id=${brandId}`, { method: "POST" });
      addLog(`Start OK. Webhook: ${res?.webhook}`);
      await loadConfig();
      await pollUntilConnected();
    } catch (e) {
      addLog(`Error start: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function onRotate() {
    if (!brandId) return;
    setLoading(true);
    try {
      const res = await api(`/api/wa/instance/rotate?brand_id=${brandId}`, { method: "POST" });
      addLog(`Instancia rotada -> ${res?.instance} / webhook: ${res?.webhook}`);
      // recargar config, luego polear QR de la nueva instancia
      await loadConfig();
      await pollUntilConnected();
    } catch (e) {
      addLog(`Error rotate: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function onTestSend() {
    if (!brandId || !to) {
      addLog("Completa brand y número destino");
      return;
    }
    setLoading(true);
    try {
      const res = await api(`/api/wa/test`, {
        method: "POST",
        body: JSON.stringify({ brand_id: brandId, to, text: txt }),
      });
      addLog(`Mensaje enviado ✔️: ${JSON.stringify(res)}`);
    } catch (e) {
      addLog(`Error test send: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    if (!brandId) return;
    setLoading(true);
    try {
      const st = await api(`/api/wa/instance/status?brand_id=${brandId}`);
      addLog(`Estado instancia: ${JSON.stringify(st?.state?.instance || st?.state)}`);
      await fetchQR();
    } catch (e) {
      addLog(`Error status: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!brandId) return;
      await loadConfig();
      await fetchQR();
      // no autopollear aquí; se dispara al Start o Rotate
    })();
    return () => {
      alive = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div style={styles.row}>
          <label style={styles.label}>Brand</label>
          <select
            value={brandId || ""}
            onChange={(e) => setBrandId(Number(e.target.value))}
            style={styles.select}
          >
            {(brands || []).map((b) => (
              <option key={b.id} value={b.id}>{b.name} (#{b.id})</option>
            ))}
          </select>
        </div>

        <div style={{ ...styles.row, gap: 8, flexWrap: "wrap" }}>
          <button style={styles.btn} disabled={!brandId || loading} onClick={onStart}>
            {loading ? "…" : "Iniciar/Reintentar (QR)"}
          </button>
          <button style={{ ...styles.btn, background: "#0ea5e9" }} disabled={!brandId || loading} onClick={onRotate}>
            {loading ? "…" : "Rotar instancia + vincular (recomendado)"}
          </button>
          <button style={styles.btn} disabled={!brandId || loading} onClick={() => pollUntilConnected()}>
            {loading ? "…" : "Pulear QR hasta conectar"}
          </button>
          <button style={styles.btn} onClick={stopPolling}>Detener poleo</button>
          <button style={styles.btn} disabled={!brandId || loading} onClick={refreshStatus}>
            {loading ? "…" : "Refrescar estado"}
          </button>
        </div>
      </header>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.h3}>Estado / Config</h3>
          <KV label="Brand" value={selectedBrand ? `${selectedBrand.name} (#${selectedBrand.id})` : "-"} />
          <KV label="Instancia" value={cfg?.instance_name || (brandId ? `brand_${brandId}` : "-")} />
          <KV label="Conectado" value={qrInfo?.connected ? "✅ Sí" : "⛔ No"} />
          <KV label="Webhook ejemplo" value={cfg?.webhook_example || "-"} mono />
          <KV
            label="Server caps"
            value={cfg?.server_caps ? JSON.stringify(cfg.server_caps) : "-"}
            mono
          />
        </div>

        <div style={styles.card}>
          <h3 style={styles.h3}>QR / Pairing</h3>
          {qrInfo?.connected ? (
            <div style={{ fontSize: 18 }}>✅ Conectado</div>
          ) : (
            <>
              {qrInfo?.qr ? (
                <img src={qrInfo.qr} alt="QR" style={{ width: 260, height: 260, borderRadius: 8, border: "1px solid #ddd" }} />
              ) : (
                <div style={{ color: "#666" }}>Sin QR disponible todavía. Pulsa “Iniciar/Reintentar (QR)” o “Rotar instancia”.</div>
              )}
              {qrInfo?.pairingCode && (
                <div style={{ marginTop: 8 }}>
                  Pairing code: <code>{qrInfo.pairingCode}</code>
                </div>
              )}
            </>
          )}
        </div>

        <div style={styles.card}>
          <h3 style={styles.h3}>Prueba de envío</h3>
          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Número MSISDN (e.g. 5493412...)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div style={styles.row}>
            <textarea
              style={{ ...styles.input, height: 80 }}
              value={txt}
              onChange={(e) => setTxt(e.target.value)}
            />
          </div>
          <button style={styles.btn} disabled={!brandId || !to || loading} onClick={onTestSend}>
            {loading ? "…" : "Enviar prueba"}
          </button>
        </div>

        <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <h3 style={styles.h3}>Log</h3>
          <div style={styles.logBox}>
            {log.map((l, i) => (
              <div key={i} style={styles.logLine}>• {l}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  header: { display: "flex", flexDirection: "column", gap: 10, padding: 12, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" },
  row: { display: "flex", alignItems: "center", gap: 6 },
  label: { minWidth: 60, fontSize: 14, color: "#374151" },
  select: { padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db" },
  btn: { padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f3f4f6", cursor: "pointer" },
  input: { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  card: { border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "white" },
  h3: { margin: 0, marginBottom: 8, fontSize: 16 },
  logBox: { maxHeight: 220, overflow: "auto", background: "#0b1020", color: "#c7d2fe", padding: 10, borderRadius: 8, fontSize: 12 },
  logLine: { opacity: 0.9, whiteSpace: "pre-wrap" },
};
