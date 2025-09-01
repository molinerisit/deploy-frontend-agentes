import React, { useEffect, useMemo, useRef, useState } from 'react';

const AGENTS = [
  { id: 'mc', label: 'MC (Orquesta CM/Copy/Diseño)' },
  { id: 'copy', label: 'Copywriter' },
  { id: 'designer', label: 'Diseñador' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'sales', label: 'Ventas' },
  { id: 'bot', label: 'Bot' },
];

export default function TeamChat({ api, brands, brandId, setBrandId }) {
  const [agent, setAgent] = useState('mc');
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [context, setContext] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const selectedBrand = useMemo(
    () => brands.find(b => b.id === brandId) || null,
    [brands, brandId]
  );

  async function loadThread(bid) {
    if (!bid) return;
    try {
      const r = await api(`/api/chat/thread?brand_id=${bid}`);
      setThreadId(r.thread_id);
      setContext(r.context || '');
      setMsgs(Array.isArray(r.messages) ? r.messages : []);
      scrollToBottom();
    } catch (e) {
      console.error('Error thread:', e);
    }
  }

  useEffect(() => {
    if (brandId) loadThread(brandId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  }

  async function send() {
    if (!brandId) return alert('Elegí una marca');
    if (!text.trim()) return;
    try {
      setLoading(true);
      // 1) Guardar el mensaje del usuario en el hilo
      const r1 = await api('/api/chat', {
        method: 'POST',
        body: { brand_id: brandId, agent, text },
      });
      setMsgs(Array.isArray(r1.messages) ? r1.messages : []);
      setContext(r1.context || '');

      // 2) Si el agente es MC, pedir respuesta del orquestador y actualizar hilo
      if (agent === 'mc') {
        const r2 = await api('/api/chat/agent/mc', {
          method: 'POST',
          body: { brand_id: brandId, text },
        });
        setMsgs(Array.isArray(r2.messages) ? r2.messages : []);
        setContext(r2.context || '');
      }

      setText('');
      scrollToBottom();
    } catch (e) {
      alert('Error enviando: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card card--chat">
      <div className="row">
        <select
          className="select"
          value={brandId || ''}
          onChange={e => setBrandId(Number(e.target.value) || null)}
        >
          <option value="">Seleccionar marca</option>
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          className="select"
          value={agent}
          onChange={e => setAgent(e.target.value)}
        >
          {AGENTS.map(a => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>

      <div className="ctx">
        <div className="ctx__title">Contexto compartido</div>
        <div className="ctx__body">{context || <i>(sin contexto)</i>}</div>
      </div>

      <div className="chat">
        {msgs.length === 0 && (
          <div className="empty">No hay mensajes en este hilo todavía.</div>
        )}
        {msgs.map(m => (
          <div key={m.id} className={`msg msg--${m.sender}`}>
            <div className="msg__meta">
              <span className="tag">{m.sender}</span>
              {m.agent && <span className="tag tag--muted">{m.agent}</span>}
            </div>
            <div className="msg__text">{m.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        <input
          className="input grow"
          placeholder="Escribí un mensaje para el equipo/agente…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
        />
        <button className="btn" disabled={loading || !text.trim()} onClick={send}>
          {loading ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
