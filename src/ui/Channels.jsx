import React, { useEffect, useRef, useState } from 'react';

export default function Channels({ api, brands, brandId, setBrandId }) {
  const [qrData, setQrData] = useState('');
  const [connected, setConnected] = useState(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  const waStart = async () => {
    if (!brandId) return alert('Elegí marca');
    setBusy(true);
    try {
      await api(`/api/wa/start?brand_id=${brandId}`, { method: 'POST' });
      startPolling();
    } catch (e) {
      alert('Error iniciando WA: ' + e.message);
    } finally { setBusy(false); }
  };

  const waQR = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      const r = await api(`/api/wa/qr?brand_id=${brandId}`);
      setConnected(r.connected ?? null);
      setQrData(r.qr || '');
    } catch (e) {
      alert('Error consultando QR: ' + e.message);
    }
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
        if (r.connected) clearInterval(pollRef.current);
      } catch { /* ignore */ }
      if (count > 20) clearInterval(pollRef.current);
    }, 3000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const [fbMsg, setFbMsg] = useState('Hola Facebook desde PRO v2');
  const [fbImg, setFbImg] = useState('');
  const [igCap, setIgCap] = useState('Hola Instagram desde PRO v2');
  const [igImg, setIgImg] = useState('https://picsum.photos/seed/ig/1200/800');

  const postFB = async () => {
    setBusy(true);
    try {
      const r = await api('/api/meta/post/facebook', { method: 'POST', body: { message: fbMsg, image_url: fbImg || null } });
      alert('Publicado FB id: ' + (r.post_id || 'OK'));
    } catch (e) { alert('Error FB: ' + e.message); } finally { setBusy(false); }
  };
  const postIG = async () => {
    setBusy(true);
    try {
      const r = await api('/api/meta/post/instagram', { method: 'POST', body: { caption: igCap, image_url: igImg } });
      alert('Publicado IG id: ' + (r.media_id || 'OK'));
    } catch (e) { alert('Error IG: ' + e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h2>Channels</h2>
      <div className="row">
        <select className="select" value={brandId || ''} onChange={e => setBrandId(Number(e.target.value) || null)}>
          <option value=''>Seleccionar marca</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <h3>WhatsApp (Evolution)</h3>
      <div className="row">
        <button className="btn" disabled={busy} onClick={waStart}>Crear/Conectar</button>
        <button className="btn" disabled={busy} onClick={waQR}>Ver QR</button>
      </div>
      {connected === false && qrData && (
        <div className="mt10">
          <div className="hint">Escaneá el QR con WhatsApp</div>
          <img alt="QR WhatsApp" src={qrData} className="qr" />
        </div>
      )}
      {connected === true && <div className="mt10 badge ok">WhatsApp conectado ✅</div>}

      <h3 className="mt16">Facebook</h3>
      <div className="row">
        <input className="input grow" placeholder="Mensaje" value={fbMsg} onChange={e => setFbMsg(e.target.value)} />
        <input className="input grow" placeholder="URL Imagen (opcional)" value={fbImg} onChange={e => setFbImg(e.target.value)} />
        <button className="btn" disabled={busy} onClick={postFB}>Publicar FB</button>
      </div>

      <h3 className="mt16">Instagram</h3>
      <div className="row">
        <input className="input grow" placeholder="Caption" value={igCap} onChange={e => setIgCap(e.target.value)} />
        <input className="input grow" placeholder="URL Imagen" value={igImg} onChange={e => setIgImg(e.target.value)} />
        <button className="btn" disabled={busy} onClick={postIG}>Publicar IG</button>
      </div>
    </div>
  );
}
