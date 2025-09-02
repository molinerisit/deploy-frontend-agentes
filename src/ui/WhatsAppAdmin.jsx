import React, { useEffect, useState } from 'react';

export default function WhatsAppAdmin({ api, brands, brandId, setBrandId }) {
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [datasources, setDatasources] = useState([]);
  const [agentMode, setAgentMode] = useState('ventas');
  const [modelName, setModelName] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [rulesMd, setRulesMd] = useState('');
  const [rulesJson, setRulesJson] = useState('');
  const [superEnabled, setSuperEnabled] = useState(true);
  const [superKeyword, setSuperKeyword] = useState('#admin');
  const [superAllowListJson, setSuperAllowListJson] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hasPassword, setHasPassword] = useState(false); // 👈
  const [dsDraft, setDsDraft] = useState({
    id: null, name: '', kind: 'postgres', url: '', headers_json: '', enabled: true, read_only: true
  });
  const [msg, setMsg] = useState('');

  // password UI
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  async function load() {
    if (!brandId) return;
    setLoading(true);
    try {
      const r = await api(`/api/wa/config?brand_id=${brandId}`);
      const c = r.config;
      setCfg(c || null);
      setDatasources(r.datasources || []);
      setWebhookUrl(r.webhook_example || '');
      setAgentMode(c?.agent_mode || 'ventas');
      setModelName(c?.model_name || '');
      setTemperature(c?.temperature ?? 0.2);
      setRulesMd(c?.rules_md || '');
      setRulesJson(c?.rules_json || '');
      setSuperEnabled(c?.super_enabled ?? true);
      setSuperKeyword(c?.super_keyword || '#admin');
      setSuperAllowListJson(c?.super_allow_list_json || '');
      setHasPassword(!!r.has_password); // 👈
    } catch (e) {
      setMsg('Error cargando config: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [brandId]);

  const save = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      setMsg('Guardando...');
      const body = {
        brand_id: brandId,
        agent_mode: agentMode,
        model_name: modelName || null,
        temperature: Number(temperature) || 0.2,
        rules_md: rulesMd || null,
        rules_json: rulesJson || null,
        super_enabled: !!superEnabled,
        super_keyword: superKeyword || '#admin',
        super_allow_list_json: superAllowListJson || null,
      };
      await api('/api/wa/config/save', { method: 'POST', body });
      setMsg('Guardado ✅');
      load();
    } catch (e) {
      setMsg('Error guardando: ' + e.message);
    }
  };

  const setPassword = async () => {
    if (!brandId) return alert('Elegí marca');
    if (!newPw || newPw.length < 6) return alert('El password nuevo debe tener al menos 6 caracteres');
    if (newPw !== newPw2) return alert('Las contraseñas no coinciden');
    try {
      const body = { brand_id: brandId, new_password: newPw, current_password: hasPassword ? currentPw : undefined };
      await api('/api/wa/config/set_password', { method: 'POST', body });
      setMsg('Password actualizado ✅');
      setCurrentPw(''); setNewPw(''); setNewPw2('');
      setHasPassword(true);
    } catch (e) {
      setMsg('Error password: ' + e.message);
    }
  };

  const editDs = (ds) => {
    setDsDraft({
      id: ds?.id || null,
      name: ds?.name || '',
      kind: ds?.kind || 'postgres',
      url: ds?.url || '',
      headers_json: ds?.headers_json || '',
      enabled: !!(ds?.enabled ?? true),
      read_only: !!(ds?.read_only ?? true),
      brand_id: brandId,
    });
  };

  const upsertDs = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      const body = { ...dsDraft, brand_id: brandId };
      await api('/api/wa/datasource/upsert', { method: 'POST', body });
      setMsg('Datasource guardado ✅');
      setDsDraft({ id: null, name: '', kind: 'postgres', url: '', headers_json: '', enabled: true, read_only: true });
      load();
    } catch (e) {
      setMsg('Error guardando DS: ' + e.message);
    }
  };

  const delDs = async (id) => {
    if (!confirm('¿Eliminar datasource?')) return;
    try {
      await api(`/api/wa/datasource/delete?id=${id}`, { method: 'DELETE' });
      setMsg('Datasource eliminado');
      load();
    } catch (e) {
      setMsg('Error eliminando DS: ' + e.message);
    }
  };

  const testDs = async () => {
    try {
      const r = await api('/api/wa/datasource/test', { method: 'POST', body: { ...dsDraft, brand_id: brandId } });
      setMsg('Test DS → ' + JSON.stringify(r));
    } catch (e) {
      setMsg('Error test DS: ' + e.message);
    }
  };

  return (
    <div className="card">
      <h2>Gestión WhatsApp</h2>
      <div className="row">
        <select className="select" value={brandId || ''} onChange={e => setBrandId(Number(e.target.value) || null)}>
          <option value=''>Seleccionar marca</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {loading && <span className="hint">cargando…</span>}
      </div>

      <h3 className="mt16">Agente & Modelo</h3>
      <div className="row">
        <label className="hint">Agente</label>
        <select className="select" value={agentMode} onChange={e => setAgentMode(e.target.value)}>
          <option value="ventas">Ventas</option>
          <option value="reservas">Reservas</option>
          <option value="auto">Automático (heurística)</option>
        </select>
        <label className="hint">Modelo (OpenAI)</label>
        <input className="input" placeholder="p.ej. gpt-4o-mini" value={modelName} onChange={e => setModelName(e.target.value)} />
        <label className="hint">Temp.</label>
        <input className="input" type="number" step="0.1" min="0" max="1" value={temperature}
               onChange={e => setTemperature(e.target.value)} style={{ width: 90 }} />
      </div>

      <h3 className="mt16">Reglas de negocio</h3>
      <div className="hint">Markdown</div>
      <textarea className="textarea" value={rulesMd} onChange={e => setRulesMd(e.target.value)} placeholder="Reglas, políticas, FAQs…" />
      <div className="hint">JSON (opcional, mini DSL)</div>
      <textarea className="textarea" value={rulesJson} onChange={e => setRulesJson(e.target.value)} placeholder='{"rules":[{"if":{"contains":["precio"]},"route":"ventas"}]}' />

      <div className="row mt8">
        <button className="btn" onClick={save}>Guardar configuración</button>
      </div>

      <h3 className="mt16">Super-Admin por WhatsApp</h3>
      <div className="hint">Keyword y whitelist se guardan en DB. El password se rota acá y se guarda hasheado (PBKDF2).</div>
      <div className="row">
        <label><input type="checkbox" checked={superEnabled} onChange={e => setSuperEnabled(e.target.checked)} /> habilitado</label>
        <input className="input" value={superKeyword} onChange={e => setSuperKeyword(e.target.value)} style={{ marginLeft: 8 }} />
      </div>
      <div className="hint">Whitelist (JSON array de números sin @… ej: ["549351XXXXXXX","54911YYYYYYY"])</div>
      <textarea className="textarea" value={superAllowListJson} onChange={e => setSuperAllowListJson(e.target.value)} />

      <div className="hint mt8">
        Webhook Evolution (configurá en Evolution → Webhook URL):
        <div><code style={{ fontSize: 12 }}>{webhookUrl || '(guardar primero para ver ejemplo)'}</code></div>
      </div>

      <h4 className="mt16">Password Admin</h4>
      {hasPassword && (
        <div className="row">
          <input className="input" type="password" placeholder="Password actual"
                 value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
        </div>
      )}
      <div className="row">
        <input className="input" type="password" placeholder="Password nuevo (>=6)"
               value={newPw} onChange={e => setNewPw(e.target.value)} />
        <input className="input" type="password" placeholder="Repetir password"
               value={newPw2} onChange={e => setNewPw2(e.target.value)} />
        <button className="btn" onClick={setPassword}>Guardar password</button>
      </div>

      <h3 className="mt16">Datasources</h3>
      <div className="hint">Postgres: usuario de SOLO LECTURA. HTTP: endpoint JSON/CSV propio.</div>

      <div className="row">
        <input className="input" placeholder="Nombre" value={dsDraft.name} onChange={e => setDsDraft({ ...dsDraft, name: e.target.value })} />
        <select className="select" value={dsDraft.kind} onChange={e => setDsDraft({ ...dsDraft, kind: e.target.value })}>
          <option value="postgres">Postgres</option>
          <option value="http">HTTP</option>
        </select>
      </div>
      <div className="row">
        <input className="input grow" placeholder="URL" value={dsDraft.url} onChange={e => setDsDraft({ ...dsDraft, url: e.target.value })} />
      </div>
      <div className="row">
        <input className="input grow" placeholder='Headers JSON (opcional)' value={dsDraft.headers_json} onChange={e => setDsDraft({ ...dsDraft, headers_json: e.target.value })} />
      </div>
      <div className="row">
        <label><input type="checkbox" checked={dsDraft.enabled} onChange={e => setDsDraft({ ...dsDraft, enabled: e.target.checked })} /> habilitado</label>
        <label style={{ marginLeft: 12 }}><input type="checkbox" checked={dsDraft.read_only} onChange={e => setDsDraft({ ...dsDraft, read_only: e.target.checked })} /> solo lectura</label>
      </div>
      <div className="row">
        <button className="btn" onClick={upsertDs}>{dsDraft.id ? 'Actualizar' : 'Agregar'}</button>
        <button className="btn" onClick={testDs}>Probar</button>
        {dsDraft.id && <button className="btn" onClick={() => setDsDraft({ id: null, name: '', kind: 'postgres', url: '', headers_json: '', enabled: true, read_only: true })}>Nuevo</button>}
      </div>

      {!!datasources.length && (
        <div className="mt10">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>URL</th><th>Habilitado</th><th></th></tr></thead>
            <tbody>
            {datasources.map(ds => (
              <tr key={ds.id}>
                <td>{ds.name}</td>
                <td>{ds.kind}</td>
                <td><code style={{ fontSize: 12 }}>{ds.url}</code></td>
                <td>{ds.enabled ? 'Sí' : 'No'}</td>
                <td>
                  <button className="btn" onClick={() => editDs(ds)}>Editar</button>
                  <button className="btn" onClick={() => delDs(ds.id)} style={{ marginLeft: 8 }}>Eliminar</button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}

      {msg && <div className="mt10 hint">{msg}</div>}
    </div>
  );
}
