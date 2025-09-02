import React, { useEffect, useRef, useState } from 'react';

// ===== Helpers para interpretar distintas formas de respuesta =====
function pickConnected(r) {
  if (typeof r?.connected === 'boolean') return r.connected;
  const s = String(r?.status || r?.state || r?.connection || '').toLowerCase();
  return s === 'connected' || s === 'online';
}
function pickQrDataUrl(r) {
  const cands = [
    r?.qr, r?.qrcode, r?.qrCode, r?.image, r?.qrImage,
    r?.dataUrl, r?.dataURL, r?.data_uri, r?.qr_data_url
  ];
  for (const v of cands) {
    if (typeof v === 'string' && v.startsWith('data:')) return v;
  }
  return '';
}
function pickLinkCode(r) {
  const cands = [r?.code, r?.linkCode, r?.link, r?.loginCode];
  for (const v of cands) {
    if (typeof v === 'string' && v.length > 8) return v;
  }
  return '';
}
function pickPairingCode(r) {
  const cands = [r?.pairingCode, r?.pairing, r?.pin, r?.code_short];
  for (const v of cands) {
    if (typeof v === 'string' && v.length <= 16 && v.length >= 4) return v;
  }
  return '';
}

// Genera un src de imagen QR con un servicio público de render si no tenemos data URL.
// (Si querés 100% self-hosted, después cambiamos esto por una lib local de QR.)
function qrFromText(text) {
  if (!text) return '';
  const base = 'https://api.qrserver.com/v1/create-qr-code/';
  const qs = `?size=280x280&data=${encodeURIComponent(text)}&t=${Date.now()}`;
  return `${base}${qs}`;
}

export default function Channels({ api, brands, brandId, setBrandId }) {
  const [connected, setConnected] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(''); // data:image/...;base64,...
  const [pairingCode, setPairingCode] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [debugPayload, setDebugPayload] = useState(null);
  const pollRef = useRef(null);

  const clearQrState = () => {
    setConnected(null);
    setQrDataUrl('');
    setPairingCode('');
    setLinkCode('');
    setStatus('');
    setErr('');
    setDebugPayload(null);
  };

  const waStart = async () => {
    if (!brandId) return alert('Elegí marca');
    setBusy(true);
    setErr('');
    setStatus('Creando/conectando instancia…');
    try {
      await api(`/api/wa/start?brand_id=${brandId}`, { method: 'POST' });
      setStatus('Instancia lista. Obteniendo QR/código…');
      await waQR();
      startPolling();
    } catch (e) {
      // Si la instancia ya existe (403), seguimos igual
      const msg = String(e?.message || e || '').toLowerCase();
      if (msg.includes('already in use') || msg.includes('already exists')) {
        setStatus('Instancia existente. Obteniendo QR/código…');
        await waQR();
        startPolling();
      } else {
        setErr('Error iniciando WA: ' + (e?.message || e));
      }
    } finally {
      setBusy(false);
    }
  };

  const waQR = async () => {
    if (!brandId) return alert('Elegí marca');
    try {
      const r = await api(`/api/wa/qr?brand_id=${brandId}`);
      setDebugPayload(r);
      console.log('[WA] /api/wa/qr payload:', r);

      const isConnected = pickConnected(r);
      const qr = pickQrDataUrl(r);
      const code = pickLinkCode(r);
      const pairing = pickPairingCode(r);

      setConnected(isConnected);
      setQrDataUrl(qr);
      setLinkCode(code);
      setPairingCode(pairing);

      if (isConnected) {
        setStatus('WhatsApp conectado ✅');
      } else if (qr || code || pairing) {
        setStatus('Escaneá el QR o ingresá el código en WhatsApp');
      } else {
        setStatus('Esperando QR/código…');
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
        setDebugPayload(r);

        const isConnected = pickConnected(r);
        const qr = pickQrDataUrl(r);
        const code = pickLinkCode(r);
        const pairing = pickPairingCode(r);

        setConnected(isConnected);
        if (qr) setQrDataUrl(qr);
        if (code) setLinkCode(code);
        if (pairing) setPairingCode(pairing);

        if (isConnected) {
          setStatus('WhatsApp conectado ✅');
          clearInterval(pollRef.current);
        } else if (qr || code || pairing) {
          setStatus('Escaneá el QR o ingresá el código en WhatsApp');
        } else {
          setStatus('Esperando QR/código…');
        }
      } catch {
        // ignoramos para no cortar el polling
      }
      if (count > 20) clearInterval(pollRef.current); // ~1 minuto
    }, 3000);
  };

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  // Computar la imagen a mostrar:
  // 1) si ya hay data URL del backend, usamos esa
  // 2) si no, pero tenemos linkCode, generamos un QR a partir del link
  // 3) si tampoco hay linkCode, pero hay pairingCode, generamos un QR del pairing (mejor que nada)
  const computedQrSrc = (() => {
    if (qrDataUrl) return qrDataUrl;
    if (linkCode) return qrFromText(linkCode);
    if (pairingCode) return qrFromText(pairingCode);
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

      {connected === true && <div className="mt10 badge ok">WhatsApp conectado ✅</div>}

      {/* Imagen QR */}
      {connected === false && computedQrSrc && (
        <div className="mt10">
          <img alt="QR WhatsApp" src={computedQrSrc} className="qr" />
        </div>
      )}

      {/* Si no hay imagen, mostramos datos para ingreso manual */}
      {connected === false && !computedQrSrc && (pairingCode || linkCode) && (
        <div className="mt10">
          {!!pairingCode && (
            <>
              <div className="hint">Ingresá este código en WhatsApp:</div>
              <div className="pairing" style={{
                fontSize: '28px', fontWeight: '700', letterSpacing: '4px',
                padding: '8px 12px', border: '1px dashed #ccc', display: 'inline-block'
              }}>
                {pairingCode}
              </div>
            </>
          )}
          {!!linkCode && (
            <>
              <div className="hint" style={{ marginTop: 10 }}>Código de enlace:</div>
              <code style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{linkCode}</code>
            </>
          )}
        </div>
      )}

      {/* Debug para ver exactamente qué devuelve el backend */}
      {debugPayload && (
        <details className="mt16" open>
          <summary>Debug (payload)</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(debugPayload, null, 2)}
          </pre>
        </details>
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
