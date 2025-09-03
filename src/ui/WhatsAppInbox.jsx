import React, { useEffect, useMemo, useState } from "react";

/**
 * Props:
 *  - api(path, {method, body}?) -> Promise<any>  (ya la tenés en ../lib/api)
 *  - brands: [{id, name}]
 *  - brandId: number|null
 *  - setBrandId: fn(number|null)
 */
export default function WhatsAppInbox({ api, brands = [], brandId, setBrandId }) {
  const [group, setGroup] = useState("column"); // column | priority | interest | tag
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(400);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [connected, setConnected] = useState(false);
  const [columns, setColumns] = useState([]); // [{key,title,color,count,chats:[...]}]

  const [openChat, setOpenChat] = useState(null); // chat seleccionado (para drawer)
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [quickText, setQuickText] = useState("");

  const [meta, setMeta] = useState({
    title: "",
    color: "",
    column: "inbox",
    priority: 0,
    interest: 0,
    pinned: false,
    archived: false,
    tags: "",
    notes: "",
  });

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId) || null,
    [brands, brandId]
  );

  async function loadBoard() {
    if (!brandId) return;
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({
        brand_id: String(brandId),
        group,
        limit: String(limit),
        show_archived: String(!!showArchived),
      });
      if (q.trim()) params.set("q", q.trim());
      const data = await api(`/api/wa/board?${params.toString()}`);
      setConnected(!!data.connected);
      setColumns(Array.isArray(data.columns) ? data.columns : []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (brandId) loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, group, showArchived]);

  const onSearch = async (e) => {
    e.preventDefault();
    await loadBoard();
  };

  // DnD
  function onDragStart(ev, chat) {
    ev.dataTransfer.setData(
      "application/json",
      JSON.stringify({ jid: chat.jid, number: chat.number, tags: chat.tags || [] })
    );
    ev.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  }
  async function onDrop(ev, colKey) {
    ev.preventDefault();
    try {
      const raw = ev.dataTransfer.getData("application/json");
      const payload = JSON.parse(raw);

      if (group === "column") {
        await api("/api/wa/chat/bulk_move", {
          method: "POST",
          body: { brand_id: brandId, jids: [payload.jid], column: colKey || "inbox" },
        });
      } else if (group === "priority") {
        const map = { p0: 0, p1: 1, p2: 2, p3: 3 };
        await api("/api/wa/chat/meta", {
          method: "POST",
          body: { brand_id: brandId, jid: payload.jid, priority: map[colKey] ?? 0 },
        });
      } else if (group === "interest") {
        const map = { unknown: 0, cold: 1, warm: 2, hot: 3 };
        await api("/api/wa/chat/meta", {
          method: "POST",
          body: { brand_id: brandId, jid: payload.jid, interest: map[colKey] ?? 0 },
        });
      } else if (group === "tag") {
        if (colKey === "_untagged") {
          await api("/api/wa/chat/meta", {
            method: "POST",
            body: { brand_id: brandId, jid: payload.jid, tags: [] },
          });
        } else if (colKey?.startsWith("tag:")) {
          const tag = colKey.slice(4);
          const tags = Array.from(new Set([...(payload.tags || []), tag]));
          await api("/api/wa/chat/meta", {
            method: "POST",
            body: { brand_id: brandId, jid: payload.jid, tags },
          });
        }
      }
      await loadBoard();
    } catch (e) {
      alert(`No se pudo mover: ${e.message}`);
    }
  }

  // Drawer
  async function openChatDrawer(chat) {
    setOpenChat(chat);
    setQuickText("");
    setMeta({
      title: chat.name || "",
      color: chat.color || "",
      column: chat.column || "inbox",
      priority: chat.priority ?? 0,
      interest: chat.interest ?? 0,
      pinned: !!chat.pinned,
      archived: !!chat.archived,
      tags: (chat.tags || []).join(", "),
      notes: chat.notes || "",
    });
    await fetchMessages(chat.jid);
  }

  async function fetchMessages(jid) {
    setMsgLoading(true);
    try {
      const params = new URLSearchParams({
        brand_id: String(brandId),
        jid,
        limit: "60",
      });
      const data = await api(`/api/wa/messages?${params.toString()}`);
      const arr = data?.messages?.data || data?.messages || data || [];
      setMessages(Array.isArray(arr) ? arr.slice(0, 60) : []);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }

  async function sendQuick() {
    if (!quickText.trim() || !openChat) return;
    try {
      await api("/api/wa/test", {
        method: "POST",
        body: { brand_id: brandId, to: openChat.number, text: quickText.trim() },
      });
      setQuickText("");
      await fetchMessages(openChat.jid);
    } catch (e) {
      alert(`No se pudo enviar: ${e.message}`);
    }
  }

  async function saveMeta() {
    if (!openChat) return;
    const tags = (meta.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await api("/api/wa/chat/meta", {
        method: "POST",
        body: {
          brand_id: brandId,
          jid: openChat.jid,
          title: meta.title || null,
          color: meta.color || null,
          column: meta.column || "inbox",
          priority: Number(meta.priority) || 0,
          interest: Number(meta.interest) || 0,
          pinned: !!meta.pinned,
          archived: !!meta.archived,
          tags,
          notes: meta.notes || null,
        },
      });
      await loadBoard();
      alert("Meta guardada");
    } catch (e) {
      alert(`Error guardando meta: ${e.message}`);
    }
  }

  const chatCard = (chat) => (
    <div
      key={chat.jid}
      className={`card chat ${chat.pinned ? "is-pinned" : ""}`}
      draggable
      onDragStart={(ev) => onDragStart(ev, chat)}
      onDoubleClick={() => openChatDrawer(chat)}
      title={chat.name || chat.number}
    >
      <div className="row sb">
        <div className="name">{chat.name || chat.number}</div>
        {!!chat.unread && <span className="badge ok">{chat.unread}</span>}
      </div>
      <div className="sub">{chat.number}</div>
      {chat.lastMessageText && <div className="last">{chat.lastMessageText}</div>}
      {Array.isArray(chat.tags) && chat.tags.length > 0 && (
        <div className="tags">
          {chat.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="card">
        <div className="row wrap">
          <select
            className="select"
            value={brandId || ""}
            onChange={(e) => setBrandId(Number(e.target.value) || null)}
          >
            <option value="">Seleccionar marca</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select className="select" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="column">Columna</option>
            <option value="priority">Prioridad</option>
            <option value="interest">Interés</option>
            <option value="tag">Tag</option>
          </select>

          <label className="hint">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            /> Mostrar archivados
          </label>

          <form onSubmit={onSearch} className="row">
            <input
              className="input"
              placeholder="Buscar por nombre / número / tag"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <button className="btn">Buscar</button>
          </form>

          <button className="btn" onClick={loadBoard} disabled={!brandId || loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>

          <div className={`badge ${connected ? "ok" : "bad"}`} style={{ marginLeft: "auto" }}>
            {connected ? "Conectado" : "No conectado"}
          </div>
        </div>

        {err && <div className="err mt8">⚠ {err}</div>}
      </div>

      <div className="board">
        {columns.map((col) => (
          <div
            key={col.key}
            className="col"
            onDragOver={(e) => onDragOver(e)}
            onDrop={(e) => onDrop(e, col.key)}
          >
            <div className="col-head">
              <div className="title">{col.title}</div>
              <div className="badge">{col.count}</div>
            </div>
            <div className="col-body">
              {(col.chats || []).map(chatCard)}
            </div>
          </div>
        ))}
        {!columns.length && !loading && (
          <div className="hint mt16">Sin chats para mostrar</div>
        )}
      </div>

      {openChat && (
        <div className="drawer">
          <div className="drawer-backdrop" onClick={() => setOpenChat(null)} />
          <div className="drawer-body">
            <div className="row sb">
              <div>
                <div className="h">{openChat.name || openChat.number}</div>
                <div className="hint">{openChat.number} — {openChat.jid}</div>
              </div>
              <button className="btn" onClick={() => setOpenChat(null)}>Cerrar</button>
            </div>

            <div className="grid2 mt12">
              {/* Mensajes */}
              <div className="pane">
                <div className="row sb">
                  <div className="h">Mensajes</div>
                  <button className="btn" onClick={() => fetchMessages(openChat.jid)} disabled={msgLoading}>
                    {msgLoading ? "..." : "Refrescar"}
                  </button>
                </div>
                <div className="msgs">
                  {messages.map((m, i) => {
                    const fromMe = m?.key?.fromMe || m?.fromMe;
                    const text =
                      m?.message?.conversation ||
                      m?.message?.extendedTextMessage?.text ||
                      m?.text || m?.body || "[mensaje]";
                    return (
                      <div key={i} className={`msg ${fromMe ? "me" : "them"}`}>
                        <div className="bubble">{text}</div>
                      </div>
                    );
                  })}
                  {!messages.length && <div className="hint">Sin mensajes recientes</div>}
                </div>
                <div className="row mt8">
                  <input
                    className="input"
                    placeholder="Respuesta rápida…"
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendQuick(); }}
                  />
                  <button className="btn" onClick={sendQuick} disabled={!quickText.trim()}>Enviar</button>
                </div>
              </div>

              {/* Meta */}
              <div className="pane">
                <div className="h">Meta</div>
                <div className="mt8">
                  <div className="hint">Título</div>
                  <input className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
                </div>
                <div className="mt8">
                  <div className="hint">Color</div>
                  <input className="input" placeholder="#RRGGBB o nombre" value={meta.color} onChange={(e) => setMeta({ ...meta, color: e.target.value })} />
                </div>
                <div className="mt8">
                  <div className="hint">Columna</div>
                  <input className="input" value={meta.column} onChange={(e) => setMeta({ ...meta, column: e.target.value })} />
                </div>
                <div className="mt8">
                  <div className="hint">Prioridad</div>
                  <select className="input" value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: Number(e.target.value) })}>
                    <option value={0}>p0 (sin)</option>
                    <option value={1}>p1 (baja)</option>
                    <option value={2}>p2 (media)</option>
                    <option value={3}>p3 (alta)</option>
                  </select>
                </div>
                <div className="mt8">
                  <div className="hint">Interés</div>
                  <select className="input" value={meta.interest} onChange={(e) => setMeta({ ...meta, interest: Number(e.target.value) })}>
                    <option value={0}>unknown</option>
                    <option value={1}>cold</option>
                    <option value={2}>warm</option>
                    <option value={3}>hot</option>
                  </select>
                </div>
                <div className="mt8">
                  <div className="hint">Tags (separadas por coma)</div>
                  <input className="input" value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} />
                </div>
                <div className="mt8">
                  <div className="hint">Notas</div>
                  <textarea className="textarea" rows={4} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
                </div>
                <div className="row mt8">
                  <label className="hint">
                    <input type="checkbox" checked={meta.pinned} onChange={(e) => setMeta({ ...meta, pinned: e.target.checked })} /> Fijado
                  </label>
                  <label className="hint">
                    <input type="checkbox" checked={meta.archived} onChange={(e) => setMeta({ ...meta, archived: e.target.checked })} /> Archivado
                  </label>
                </div>
                <button className="btn mt12" onClick={saveMeta}>Guardar meta</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
