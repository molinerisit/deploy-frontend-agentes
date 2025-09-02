import React, { useEffect, useRef, useState } from 'react';

export default function Channels({ api, brands, brandId, setBrandId }) {
  const [connected, setConnected] = useState(null);
  const [qrData, setQrData] = useState('');           // data URL (o vacío)
  const [pairingCode, setPairingCode] = useState(''); // ej: "WZYEH1YY"
  const [linkCode, setLinkCode] = useState('');       // string largo que sirve para QR
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');           // Mensaje de estado
  const [err, setErr] = useState('');
  const pollRef = useRef(null);

  const clearQrState = () => {
    setConnected(null);
    setQrData('');
    setPairingCode('');
    setLinkCode('');
    setStatus('');
    setErr('');
  };

  const waStart = async () => {
    if (!brandId) return alert('Elegí marca');
    setBusy(true);
    setErr('');
    setStatus('Creando/conectando instancia…');
    try {
      await api(`/api/wa/start?brand_id=${brandId}`, { method: 'POST' });
      setStatus('Instancia creada. Obteniendo QR…');
      await waQR();      // primer fetch inmediato
      startPolling();    // y luego polling
    } catch (e) {
      setErr('Error iniciando WA: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const waQR = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      const r = await api(`/api/wa/qr?brand_id=${brandId}`);
      // r puede traer: { connected, qr (data URL opcional), pairingCode, code }
      setConnected(Boolean(r.connected));

      // 1) si viene qr como data URL, usamos eso
      if (r.qr && typeof r.qr === 'string' && r.qr.startsWith('data:')) {
        setQrData(r.qr);
      } else {
        setQrData('');
      }

      // 2) guardamos pairing/code como fallback
      setPairingCode(r.pairingCode || '');
      setLinkCode(r.code || '');

      if (r.connected) {
        setStatus('WhatsApp conectado ✅');
      } else if (r.qr || r.code || r.pairingCode) {
        setStatus('Escaneá el QR o ingresá el código en WhatsApp');
      } else {
        setStatus('Esperando código/QR…');
      }
    } catch (e) {
      setErr('Error consultando QR: ' + (e?.message || e));
    }
  };

  const startPolling = () => {
    clearInterval(pollRef.current);
    let count = 0;
    pollRef.current = setInterval(async () => {
      count += 1;
      try {
        const r = await api(`/api/wa/qr?brand_id=${brandId}`);
        setConnected(Boolean(r.connected));

        if (r.qr && typeof r.qr === 'string' && r.qr.startsWith('data:')) {
          setQrData(r.qr);
        }
        setPairingCode(r.pairingCode || '');
        setLinkCode(r.code || '');

        if (r.connected) {
          setStatus('WhatsApp conectado ✅');
          clearInterval(pollRef.current);
        } else if (r.qr || r.code || r.pairingCode) {
          setStatus('Escaneá el QR o ingresá el código en WhatsApp');
        } else {
          setStatus('Esperando código/QR…');
        }
      } catch {
        // ignoramos para no frenar el polling
      }
      if (count > 20) clearInterval(pollRef.current); // ~1 minuto
    }, 3000);
  };

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  // Fallback de imagen QR si el backend no mandó data URL:
  // si tenemos "code", generamos un QR remoto (render) sin JS extra.
  const computedQrSrc = (() => {
    if (qrData) return qrData; // data URL directa desde el backend
    if (linkCode) {
      const url = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data='
        + encodeURIComponent(linkCode);
      return url;
    }
    return '';
  })();

  return (
    <div className="card">
      <h2>Channels</h2>

      <div className="row">
        <select
          className="select"
          value={brandId || ''}
          onChange={e => {
            clearInterval(pollRef.current);
            clearQrState();
            setBrandId(Number(e.target.value) || null);
          }}
        >
          <option value=''>Seleccionar marca</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <h3>WhatsApp (Evolution)</h3>

      <div className="row">
        <button className="btn" disabled={busy || !brandId} onClick={waStart}>Crear/Conectar</button>
        <button className="btn" disabled={busy || !brandId} onClick={waQR}>Ver QR / Código</button>
        <button
          className="btn"
          disabled={!brandId}
          onClick={() => { clearInterval(pollRef.current); startPolling(); }}
          title="Reintentar polling"
        >
          Reintentar
        </button>
      </div>

      {(status || err) && (
        <div className="mt10">
          {status && <div className="hint">{status}</div>}
          {err && <div className="err">{err}</div>}
        </div>
      )}

      {/* Estado visual */}
      {connected === true && <div className="mt10 badge ok">WhatsApp conectado ✅</div>}

      {/* Mostrar QR (data URL o generado desde 'code') */}
      {connected === false && computedQrSrc && (
        <div className="mt10">
          <img alt="QR WhatsApp" src={computedQrSrc} className="qr" />
        </div>
      )}

      {/* Si no hay imagen pero sí pairingCode, mostrarlo grande */}
      {connected === false && !computedQrSrc && pairingCode && (
        <div className="mt10">
          <div className="hint">Ingresá este código en WhatsApp:</div>
          <div className="pairing" style={{
            fontSize: '28px', fontWeight: '700', letterSpacing: '4px',
            padding: '8px 12px', border: '1px dashed #ccc', display: 'inline-block'
          }}>
            {pairingCode}
          </div>
        </div>
      )}

      <h3 className="mt16">Facebook</h3>
      <FacebookForm api={api} />

      <h3 className="mt16">Instagram</h3>
      <InstagramForm api={api} />
    </div>
  );
}

function FacebookForm({ api }) {
  const [busy, setBusy] = useState(false);
  const [fbMsg, setFbMsg] = useState('Hola Facebook desde PRO v2');
  const [fbImg, setFbImg] = useState('');

  const postFB = async () => {
    setBusy(true);
    try {
      const r = await api('/api/meta/post/facebook', {
        method: 'POST',
        body: { message: fbMsg, image_url: fbImg || null }
      });
      alert('Publicado FB id: ' + (r.post_id || 'OK'));
    } catch (e) {
      alert('Error FB: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row">
      <input className="input grow" placeholder="Mensaje" value={fbMsg} onChange={e => setFbMsg(e.target.value)} />
      <input className="input grow" placeholder="URL Imagen (opcional)" value={fbImg} onChange={e => setFbImg(e.target.value)} />
      <button className="btn" disabled={busy} onClick={postFB}>Publicar FB</button>
    </div>
  );
}

function InstagramForm({ api }) {
  const [busy, setBusy] = useState(false);
  const [igCap, setIgCap] = useState('Hola Instagram desde PRO v2');
  const [igImg, setIgImg] = useState('https://picsum.photos/seed/ig/1200/800');

  const postIG = async () => {
    setBusy(true);
    try {
      const r = await api('/api/meta/post/instagram', {
        method: 'POST',
        body: { caption: igCap, image_url: igImg }
      });
      alert('Publicado IG id: ' + (r.media_id || 'OK'));
    } catch (e) {
      alert('Error IG: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row">
      <input className="input grow" placeholder="Caption" value={igCap} onChange={e => setIgCap(e.target.value)} />
      <input className="input grow" placeholder="URL Imagen" value={igImg} onChange={e => setIgImg(e.target.value)} />
      <button className="btn" disabled={busy} onClick={postIG}>Publicar IG</button>
    </div>
  );
}
