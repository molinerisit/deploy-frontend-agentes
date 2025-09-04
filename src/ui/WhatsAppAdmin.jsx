import React, { useEffect, useMemo, useRef, useState } from "react";

export default function WhatsAppAdmin({ api, brands, brandId, setBrandId }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [connected, setConnected] = useState(null);
  const [qrData, setQrData] = useState("");
  const pollRef = useRef(null);

  // Estado de configuración editable
  const [cfg, setCfg] = useState({
    agent_mode: "ventas",
    model_name: "",
    temperature: 0.2,
    rules_md: "",
    rules_json: "",
    super_enabled: true,
    super_keyword: "#admin",
    super_allow_list: "", // CSV para UI
    super_password_new: "",
    super_password_new2: "",
  });

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId) || null,
    [brands, brandId]
  );

  // Carga de config (lee res.config)
  useEffect(() => {
    setErr("");
    setOk("");
    if (!brandId) return;
    (async () => {
      try {
        console.debug("[WAAdmin] GET /api/wa/config", { brandId });
        const res = await api(`/api/wa/config?brand_id=${brandId}`);
        console.debug("[WAAdmin] /config result:", res);
        const c = res?.config || {};
        setCfg((prev) => ({
          ...prev,
          agent_mode: c.agent_mode ?? prev.agent_mode,
          model_name: c.model_name ?? prev.model_name,
          temperature: typeof c.temperature === "number" ? c.temperature : prev.temperature,
          rules_md: c.rules_md ?? prev.rules_md,
          rules_json: c.rules_json ?? prev.rules_json,
          super_enabled: typeof c.super_enabled === "boolean" ? c.super_enabled : prev.super_enabled,
          super_keyword: c.super_keyword ?? prev.super_keyword,
          super_allow_list: (() => {
            if (typeof c.super_allow_list_json === "string" && c.super_allow_list_json.trim().startsWith("[")) {
              try {
                const arr = JSON.parse(c.super_allow_list_json);
                if (Array.isArray(arr)) return arr.join(",");
              } catch {}
            }
            if (Array.isArray(c.super_allow_list_json)) return c.super_allow_list_json.join(",");
            return "";
          })(),
        }));
      } catch (e) {
        console.debug("GET /api/wa/config fallo o no disponible:", e?.message || e);
      }
    })();
  }, [brandId, api]);

  const onChange = (field, val) => setCfg((prev) => ({ ...prev, [field]: val }));

  // Guardar config con fallback PUT -> POST /config/set
  const saveCfg = async () => {
    if (!brandId) return alert("Elegí una marca");
    if (cfg.super_password_new && cfg.super_password_new !== cfg.super_password_new2) {
      return alert("Las contraseñas de admin no coinciden");
    }
    setBusy(true);
    setErr("");
    setOk("");
    const body = {
      brand_id: brandId,
      agent_mode: cfg.agent_mode,
      model_name: cfg.model_name || null,
      temperature: Number(cfg.temperature) || 0.2,
      rules_md: cfg.rules_md || "",
      rules_json: cfg.rules_json || "",
      super_enabled: !!cfg.super_enabled,
      super_keyword: cfg.super_keyword || "#admin",
      super_allow_list: (cfg.super_allow_list || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      super_password_new: cfg.super_password_new || null,
    };
    try {
      try {
        console.debug("[WAAdmin] PUT /api/wa/config", body);
        await api("/api/wa/config", { method: "PUT", body });
      } catch (e) {
        console.debug("[WAAdmin] PUT cayó, intento POST /api/wa/config/set", e?.message);
        await api("/api/wa/config/set", { method: "POST", body });
      }
      setOk("Configuración guardada");
      setCfg((prev) => ({ ...prev, super_password_new: "", super_password_new2: "" }));
    } catch (e) {
      console.error("[WAAdmin] Error guardando configuración:", e);
      setErr(`Error guardando configuración: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const startConnect = async () => {
    if (!brandId) return alert("Elegí una marca");
    setBusy(true);
    setErr("");
    setOk("");
    try {
      console.debug("[WAAdmin] POST /api/wa/start", { brandId });
      const r = await api(`/api/wa/start?brand_id=${brandId}`, { method: "POST" });
      console.debug("[WAAdmin] /start resp:", r);
      setOk("Instancia creada/conectando…");
      startPolling();
    } catch (e) {
      console.error("[WAAdmin] Error iniciando WA:", e);
      setErr(`Error iniciando WA: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const fetchQR = async () => {
    if (!brandId) return alert("Elegí una marca");
    setBusy(true);
    setErr("");
    setOk("");
    try {
      console.debug("[WAAdmin] GET /api/wa/qr", { brandId });
      const r = await api(`/api/wa/qr?brand_id=${brandId}`);
      console.debug("[WAAdmin] /qr resp:", r);
      setConnected(!!r.connected);
      setQrData(r.qr || r.qrcode || r.qrCode || r.dataUrl || r.dataURL || "");
      if (r.connected) setOk("WhatsApp conectado ✅");
    } catch (e) {
      console.error("[WAAdmin] Error consultando QR:", e);
      setErr(`Error consultando QR: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const startPolling = () => {
    clearInterval(pollRef.current);
    let count = 0;
    pollRef.current = setInterval(async () => {
      count += 1;
      try {
        const r = await api(`/api/wa/qr?brand_id=${brandId}`);
        console.debug("[WAAdmin] poll /qr resp:", r);
        setConnected(!!r.connected);
        setQrData(r.qr || r.qrcode || r.qrCode || r.dataUrl || r.dataURL || "");
        if (r.connected) {
          clearInterval(pollRef.current);
          setOk("WhatsApp conectado ✅");
        }
      } catch (e) {
        console.debug("[WAAdmin] poll /qr error:", e?.message);
      }
      if (count > 30) clearInterval(pollRef.current);
    }, 3000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  // Test envío
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("Hola! Prueba desde Gestión WhatsApp");
  const sanitizeNumber = (s) => (s || "").replace(/\D+/g, "");
  const sendTest = async () => {
    if (!brandId) return alert("Elegí una marca");
    if (!testTo.trim()) return alert("Ingresá un número destino (código país, sin +)");
    const to = sanitizeNumber(testTo.trim());
    if (!to) return alert("Número inválido");
    setBusy(true);
    setErr("");
    setOk("");
    try {
      console.debug("[WAAdmin] POST /api/wa/test", { brandId, to, text: testMsg });
      const r = await api("/api/wa/test", { method: "POST", body: { brand_id: brandId, to, text: testMsg } });
      console.debug("[WAAdmin] /test resp:", r);
      setOk("Mensaje de prueba enviado");
    } catch (e) {
      console.error("[WAAdmin] Error enviando prueba:", e);
      setErr(`Error enviando prueba: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // === Acciones nuevas ===
  const forceWebhook = async () => {
    if (!brandId) return alert("Elegí una marca");
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await api(`/api/wa/set_webhook?brand_id=${brandId}`);
      console.debug("[WAAdmin] set_webhook resp:", r);
      setOk("Webhook forzado (ver logs del backend).");
    } catch (e) {
      setErr("Error set_webhook: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const syncPull = async () => {
    if (!brandId) return alert("Elegí una marca");
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await api(`/api/wa/sync_pull?brand_id=${brandId}`, { method: "POST" });
      setOk(`Sync (pull) OK — guardados ${r?.saved ?? 0} mensajes.`);
    } catch (e) {
      setErr("Error en sync (pull): " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Gestión WhatsApp</h2>

      <div className="row">
        <select className="select" value={brandId || ""} onChange={(e) => setBrandId(Number(e.target.value) || null)}>
          <option value="">Seleccionar marca</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {selectedBrand && <div className="hint">Marca: <b>{selectedBrand.name}</b></div>}
      </div>

      {err && <div className="err mt8">⚠ {err}</div>}
      {ok && <div className="badge ok mt8">{ok}</div>}

      <h3 className="mt16">Conexión</h3>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn" disabled={busy || !brandId} onClick={startConnect}>Crear/Conectar</button>
        <button className="btn" disabled={busy || !brandId} onClick={fetchQR}>Ver QR / Estado</button>
        <button className="btn" disabled={busy || !brandId} onClick={forceWebhook} title="Probar múltiples rutas de webhook">
          Forzar webhook
        </button>
        <button className="btn" disabled={busy || !brandId} onClick={syncPull} title="Tirar del histórico para poblar DB">
          Sync (pull)
        </button>
      </div>
      {connected === false && qrData && (
        <div className="mt10">
          <div className="hint">Escaneá el QR con WhatsApp</div>
          <img alt="QR WhatsApp" src={qrData} className="qr" />
        </div>
      )}
      {connected === true && <div className="mt10 badge ok">WhatsApp conectado ✅</div>}

      <h3 className="mt16">Agente</h3>
      <div className="row">
        <label className="hint">Modo</label>
        <select className="select" value={cfg.agent_mode} onChange={(e) => onChange("agent_mode", e.target.value)}>
          <option value="ventas">Ventas</option>
          <option value="reservas">Reservas</option>
          <option value="auto">Auto (según intención)</option>
        </select>
        <label className="hint">Modelo</label>
        <input
          className="input"
          placeholder="gpt-4o-mini"
          value={cfg.model_name}
          onChange={(e) => onChange("model_name", e.target.value)}
          style={{ maxWidth: 220 }}
        />
        <label className="hint">Temp.</label>
        <input
          type="number"
          className="input"
          step="0.1"
          min="0"
          max="1"
          value={cfg.temperature}
          onChange={(e) => onChange("temperature", e.target.value)}
          style={{ width: 90 }}
        />
      </div>

      <div className="mt8">
        <div className="hint">Reglas de negocio (Markdown)</div>
        <textarea className="textarea" value={cfg.rules_md} onChange={(e) => onChange("rules_md", e.target.value)} />
      </div>
      <div className="mt8">
        <div className="hint">Reglas estructuradas (JSON)</div>
        <textarea className="textarea" value={cfg.rules_json} onChange={(e) => onChange("rules_json", e.target.value)} />
      </div>

      <h3 className="mt16">Super Admin</h3>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={cfg.super_enabled}
            onChange={(e) => onChange("super_enabled", e.target.checked)}
          />{" "}
          Habilitar
        </label>
        <label className="hint">Keyword</label>
        <input
          className="input"
          placeholder="#admin"
          value={cfg.super_keyword}
          onChange={(e) => onChange("super_keyword", e.target.value)}
          style={{ maxWidth: 160 }}
        />
        <label className="hint">Números permitidos (CSV)</label>
        <input
          className="input grow"
          placeholder="549351XXXXXXX,54911YYYYYYY"
          value={cfg.super_allow_list}
          onChange={(e) => onChange("super_allow_list", e.target.value)}
        />
      </div>
      <div className="row mt8">
        <input
          className="input"
          type="password"
          placeholder="Nuevo password admin (opcional)"
          value={cfg.super_password_new}
          onChange={(e) => onChange("super_password_new", e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Repetir nuevo password"
          value={cfg.super_password_new2}
          onChange={(e) => onChange("super_password_new2", e.target.value)}
        />
        <button className="btn" disabled={busy || !brandId} onClick={saveCfg}>
          {busy ? "..." : "Guardar configuración"}
        </button>
      </div>

      <h3 className="mt16">Prueba rápida</h3>
      <div className="row">
        <input
          className="input"
          placeholder="Destino (ej: 549351XXXXXXX)"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
        />
        <input
          className="input grow"
          placeholder="Mensaje"
          value={testMsg}
          onChange={(e) => setTestMsg(e.target.value)}
        />
        <button className="btn" disabled={busy || !brandId} onClick={sendTest}>
          Enviar
        </button>
      </div>
    </div>
  );
}
