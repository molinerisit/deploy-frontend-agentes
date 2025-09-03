// frontend/src/ui/Brands.jsx
import React, { useEffect, useState } from 'react';

export default function Brands({ api, brands, setBrands, brandId, setBrandId, selectedBrand }) {
  const [name, setName] = useState('Marca Pepito');
  const [tone, setTone] = useState('cercano y directo');
  const [context, setContext] = useState('Campaña primavera Rosario');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedBrand) { 
      setContext(''); 
      return; 
    }
    setContext(selectedBrand?.context || '');
  }, [selectedBrand]);

  async function refetchBrandsAndSelect(idToSelect) {
    try {
      const bs = await api('/api/brands');
      setBrands(Array.isArray(bs) ? bs : []);
      if (idToSelect) setBrandId(idToSelect);
      else if (Array.isArray(bs) && bs.length && !brandId) setBrandId(bs[0].id);
    } catch (e) {
      console.error('Error refetch brands:', e);
    }
  }

  const addBrand = async () => {
    if (!name.trim()) return alert('Ingresá un nombre de marca');
    try {
      setSaving(true);
      const created = await api('/api/brands', { method: 'POST', body: { name, tone } });
      await refetchBrandsAndSelect(created?.id);
      if ((context || '').trim() && created?.id) {
        await api('/api/context/set', { method: 'POST', body: { brand_id: created.id, context } });
      }
    } catch (e) { 
      alert('Error creando marca: ' + e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const saveCtx = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      setSaving(true);
      await api('/api/context/set', { method: 'POST', body: { brand_id: brandId, context } });
    } catch (e) { 
      alert('Error guardando contexto: ' + e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="card">
      <h2>Brands & Contexto Compartido</h2>
      <div className="row">
        <input 
          className="input" 
          placeholder="Nombre" 
          value={name} 
          onChange={e => setName(e.target.value)} 
        />
        <input 
          className="input" 
          placeholder="Tono" 
          value={tone} 
          onChange={e => setTone(e.target.value)} 
        />
        <button className="btn" disabled={saving} onClick={addBrand}>
          {saving ? '...' : 'Crear marca'}
        </button>
      </div>
      <div className="row mt8">
        <select 
          className="select" 
          value={brandId || ''} 
          onChange={e => setBrandId(Number(e.target.value) || null)}
        >
          <option value=''>Seleccionar marca</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="hint">Seleccionada</div>
      </div>
      <div className="mt8">
        <div className="hint">Contexto compartido (visible para todos los agentes)</div>
        <textarea 
          className="textarea" 
          value={context} 
          onChange={e => setContext(e.target.value)} 
        />
        <button className="btn" disabled={saving || !brandId} onClick={saveCtx} title={!brandId ? 'Seleccioná una marca' : ''}>
          {saving ? '...' : 'Guardar contexto'}
        </button>
      </div>
    </div>
  );
}
