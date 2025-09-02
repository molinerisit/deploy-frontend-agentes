import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function WhatsAppAdmin({ api, brands, brandId, setBrandId }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [connected, setConnected] = useState(null);
  const [qrData, setQrData] = useState('');
  const pollRef = useRef(null);

  // Config WA (server-side). Si el endpoint no existe todavía, usamos defaults.
  const [cfg, setCfg] = useState({
    agent_mode: 'ventas',     // ventas | reservas | auto
    model_name: '',           // ej: gpt-4o-mini
    temperature: 0.2,
    rules_md: '',
    rules_json: '',
    super_enabled: true,
    super_keyword: '#admin',
    super_allow_list: '',     // CSV, ej: 549351XXXXXXX,54911YYYYYYY
    super_password_new: '',   // para rotar password
    super_password_new2: '',
  });

  const selectedBrand = useMemo(
    () => brands.find(b => b.id === brandId) || null,
    [brands, brandId]
  );

  useEffect(() => {
    setErr(''); setOk('');
    if (!brandId) return;

    (async () => {
      try {
        // Intentamos leer configuración. Si 404, seguimos con defaults.
        const res = await api(`/api/wa/config?brand_id=${brandId}`);
        if (res && typeof res === 'object') {
          setCfg(prev => ({
            ...prev,
            agent_mode: res.agent_mode ?? prev.agent_mode,
            model_name: res.model_name ?? prev.model_name,
            temperature: typeof res.temperature === 'number' ? res.temperature : prev.temperature,
            rules_md: res.rules_md ?? prev.rules_md,
            rules_json: res.rules_json ?? prev.rules_json,
            super_enabled: typeof res.super_enabled === 'boolean' ? res.super_enabled : prev.super_enabled,
            super_keyword: res.super_keyword ?? prev.super_keyword,
            super_allow_list: (res.super_allow_list || res.super_allow_list_json || '')
              .toString()
              .replace(/[\[\]"]/g, ''), // normalizamos si viene como JSON de array
          }));
        }
      } catch (e) {
        // Si el endpoint no está implementado aún, lo ignoramos
        console.debug('GET /api/wa/config no disponible:', e?.message || e);
      }
    })();
  }, [brandId, api]);

  const onChange = (field, val) => setCfg(prev => ({ ...prev, [field]: val }));

  const saveCfg = async () => {
    if (!brandId) return alert('Elegí una marca');
    if (cfg.super_password_new && cfg.super_password_new !== cfg.super_password_new2) {
      return alert('Las contraseñas de admin no coinciden');
    }
    setBusy(true); setErr(''); setOk('');
    try {
      const body = {
        brand_id: brandId,
        agent_mode: cfg.agent_mode,
        model_name: cfg.model_name || null,
        temperature: Number(cfg.temperature) || 0.2,
        rules_md: cfg.rules_md || '',
        rules_json: cfg.rules_json || '',
        super_enabled: !!cfg.super_enabled,
        super_keyword: cfg.super_keyword || '#admin',
        super_allow_list: (cfg.super_allow_list || '').split(',').map(s => s.trim()).filter(Boolean),
        super_password_new: cfg.super_password_new || null, // si viene null, backend no rota
      };
      // PUT recomendado; si tu backend usa POST, adaptá aquí.
      const r = await api('/api/wa/config', { method: 'PUT', body });
      setOk('Configuración guardada');
      // limpiamos campo de password para no dejarlo en memoria
      setCfg(prev => ({ ...prev, super_password_new: '', super_password_new2: '' }));
    } catch (e) {
      setErr(`Error guardando configuración: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const startConnect = async () => {
    if (!brandId) return alert('Elegí una marca');
    setBusy(true); setErr(''); setOk('');
    try {
      await api(`/api/wa/start?brand_id=${brandId}`, { method: 'POST' });
      setOk('Instancia creada/conectando…');
      startPolling();
    } catch (e) {
      setErr(`Error iniciando WA: ${e.message}`);
    } finally { setBusy(false); }
  };

  const fetchQR = async () => {
    if (!brandId) return alert('Elegí una marca');
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await api(`/api/wa/qr?brand_id=${brandId}`);
      setConnected(r.connected ?? null);
      setQrData(r.qr || '');
      if (r.connected) setOk('WhatsApp conectado ✅');
    } catch (e) {
      setErr(`Error consultando QR: ${e.message}`);
    } finally { setBusy(false); }
  };

  const startPolling = () => {
    clearInterval(pollRef.current);
    let count = 0;
    pollRef.current = setInterval(async () => {
      count += 1;
      try {
        const r = await api(`/api/wa/qr?brand_id=${brandId}`);
        setConnected(r.connected ?? null);
        setQrData(r.qr || '');
        if (r.connected) {
          clearInterval(pollRef.current);
          setOk('WhatsApp conectado ✅');
        }
      } catch { /* ignore */ }
      if (count > 30) clearInterval(pollRef.current);
    }, 3000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  // Test de envío (opcional): si tu backend expone /api/wa/test
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('Hola! Prueba desde Gestión WhatsApp');

  const sendTest = async () => {
    if (!brandId) return alert('Elegí una marca');
    if (!testTo.trim()) return alert('Ingresá un número destino (código país, sin +)');
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await api('/api/wa/test', { method: 'POST', body: { brand_id: brandId, to: testTo.trim(), text: testMsg } });
      setOk('Mensaje de prueba enviado');
    } catch (e) {
      setErr(`Error enviando prueba: ${e.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h2>Gestión WhatsApp</h2>

      <div className="row">
        <select className="select" value={brandId || ''} onChange={e => setBrandId(Number(e.target.value) || null)}>
          <option value=''>Seleccionar marca</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {selectedBrand && <div className="hint">Marca seleccionada: <b>{selectedBrand.name}</b></div>}
      </div>

      {err && <div className="err mt8">{err}</div>}
      {ok && <div className="badge ok mt8">{ok}</div>}

      <h3 className="mt16">Conexión</h3>
      <div className="row">
        <button className="btn" disabled={busy || !brandId} onClick={startConnect}>Crear/Conectar</button>
        <button className="btn" disabled={busy || !brandId} onClick={fetchQR}>Ver QR / Estado</button>
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
        <select className="select" value={cfg.agent_mode} onChange={e => onChange('agent_mode', e.target.value)}>
          <option value="ventas">Ventas</option>
          <option value="reservas">Reservas</option>
          <option value="auto">Auto (según intención)</option>
        </select>
        <label className="hint">Modelo</label>
        <input className="input" placeholder="gpt-4o-mini" value={cfg.model_name} onChange={e => onChange('model_name', e.target.value)} style={{maxWidth: 220}} />
        <label className="hint">Temp.</label>
        <input type="number" className="input" step="0.1" min="0" max="1" value={cfg.temperature}
          onChange={e => onChange('temperature', e.target.value)} style={{width: 90}} />
      </div>

      <div className="mt8">
        <div className="hint">Reglas de negocio (Markdown)</div>
        <textarea className="textarea" value={cfg.rules_md} onChange={e => onChange('rules_md', e.target.value)} />
      </div>
      <div className="mt8">
        <div className="hint">Reglas estructuradas (JSON)</div>
        <textarea className="textarea" value={cfg.rules_json} onChange={e => onChange('rules_json', e.target.value)} />
      </div>

      <h3 className="mt16">Super Admin</h3>
      <div className="row">
        <label><input type="checkbox" checked={cfg.super_enabled} onChange={e => onChange('super_enabled', e.target.checked)} /> Habilitar</label>
        <label className="hint">Keyword</label>
        <input className="input" placeholder="#admin" value={cfg.super_keyword} onChange={e => onChange('super_keyword', e.target.value)} style={{maxWidth: 160}} />
        <label className="hint">Números permitidos (CSV)</label>
        <input className="input grow" placeholder="549351XXXXXXX,54911YYYYYYY" value={cfg.super_allow_list} onChange={e => onChange('super_allow_list', e.target.value)} />
      </div>
      <div className="row mt8">
        <input className="input" type="password" placeholder="Nuevo password admin (opcional)" value={cfg.super_password_new} onChange={e => onChange('super_password_new', e.target.value)} />
        <input className="input" type="password" placeholder="Repetir nuevo password" value={cfg.super_password_new2} onChange={e => onChange('super_password_new2', e.target.value)} />
        <button className="btn" disabled={busy || !brandId} onClick={saveCfg}>{busy ? '...' : 'Guardar configuración'}</button>
      </div>

      <h3 className="mt16">Prueba rápida</h3>
      <div className="row">
        <input className="input" placeholder="Destino (ej: 549351XXXXXXX)" value={testTo} onChange={e => setTestTo(e.target.value)} />
        <input className="input grow" placeholder="Mensaje" value={testMsg} onChange={e => setTestMsg(e.target.value)} />
        <button className="btn" disabled={busy || !brandId} onClick={sendTest}>Enviar</button>
      </div>
    </div>
  );
}
