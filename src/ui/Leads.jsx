import React, { useEffect, useState } from 'react';

export default function Leads({ api, brands, brandId, setBrandId }) {
  const [raw, setRaw] = useState('Hola, quiero una campaña para octubre, presupuesto 200k. Soy Carla.');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const ingest = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      setLoading(true);
      const l = await api('/api/leads/ingest', {
        method: 'POST',
        body: { brand_id: brandId, raw_text: raw, channel: 'web' },
      });
      setLeads([l, ...leads]);
    } catch (e) {
      alert('Error calificando lead: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const list = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      setLoading(true);
      const qs = new URLSearchParams({
        brand_id: String(brandId),
        page: String(page),
        page_size: String(pageSize),
      }).toString();
      const ls = await api(`/api/leads?${qs}`);
      setLeads(Array.isArray(ls) ? ls : (ls.items || []));
    } catch (e) {
      alert('Error listando leads: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brandId) list();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  return (
    <div className="card">
      <h2>Leads</h2>
      <div className="row">
        <select
          className="select"
          value={brandId || ''}
          onChange={e => setBrandId(Number(e.target.value) || null)}
        >
          <option value=''>Seleccionar marca</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="row mt8">
        <input
          className="input grow"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder="Pegá el mensaje del lead…"
        />
        <button className="btn" disabled={loading} onClick={ingest}>
          {loading ? '...' : 'Calificar'}
        </button>
        <button className="btn" disabled={loading} onClick={list}>
          {loading ? '...' : 'Listar'}
        </button>
      </div>

      <div className="row mt8">
        <label className="hint">Página</label>
        <input
          className="input small"
          type="number"
          min="1"
          value={page}
          onChange={e => setPage(Math.max(1, Number(e.target.value) || 1))}
        />
        <label className="hint">Tamaño</label>
        <input
          className="input small"
          type="number"
          min="5"
          value={pageSize}
          onChange={e => setPageSize(Math.max(5, Number(e.target.value) || 10))}
        />
      </div>

      <table className="table mt10">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Canal</th>
            <th>Status</th>
            <th>Score</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(l => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>{l.name || ''}</td>
              <td>{l.channel || ''}</td>
              <td>{l.status || ''}</td>
              <td>{String(l.score ?? '')}</td>
              <td>
                <details>
                  <summary>ver</summary>
                  <pre className="prewrap">{l.profile_json || l.notes}</pre>
                </details>
              </td>
            </tr>
          ))}
          {!leads.length && (
            <tr>
              <td colSpan={6} className="empty">Sin resultados</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
