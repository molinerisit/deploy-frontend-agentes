import React, { useEffect, useMemo, useState } from "react";
import Brands from "./Brands";
import TeamChat from "./TeamChat";
import Channels from "./Channels";
import Leads from "./Leads";
import WhatsAppAdmin from "./WhatsAppAdmin"; // 👈 IMPORTANTE
import { api, API_BASE } from "../lib/api";
import WhatsAppInbox from "./WhatsAppInbox"; // 👈 importar

import "./styles.css";

const TABS = [
  { id: "chat", label: "Team Chat" },
  { id: "brands", label: "Brands & Context" },
  { id: "channels", label: "Channels" },
  { id: "waadmin", label: "Gestión WhatsApp" }, // 👈 NUEVA
  { id: "leads", label: "Leads" },
  { id: "wainbox", label: "WhatsApp Inbox" }, // 👈 NUEVA
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState(null);
  const [health, setHealth] = useState("⏳");
  const [err, setErr] = useState("");
  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId) || null,
    [brands, brandId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await api("/api/health");
        if (mounted) setHealth("✅");
      } catch {
        if (mounted) setHealth("❌");
      }
      try {
        const bs = await api("/api/brands");
        if (!mounted) return;
        setBrands(Array.isArray(bs) ? bs : []);
        if (Array.isArray(bs) && bs.length && !brandId) setBrandId(bs[0].id);
      } catch (e) {
        if (mounted) setErr(String(e.message || e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="app">
      <aside className="aside">
        <h2 className="h">Marketing PRO v2</h2>
        <div className="meta">
          <div>
            API: <code>{API_BASE}</code>
          </div>
          <div>
            Backend:{" "}
            <span
              className={`badge ${
                health === "✅" ? "ok" : health === "❌" ? "bad" : "wait"
              }`}
            >
              {health}
            </span>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`navbtn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {err && <div className="err">{err}</div>}
      </aside>

      <main className="main">
        {tab === "chat" && (
          <TeamChat
            api={api}
            brands={brands}
            brandId={brandId}
            setBrandId={setBrandId}
          />
        )}
        {tab === "brands" && (
          <Brands
            api={api}
            brands={brands}
            setBrands={setBrands}
            brandId={brandId}
            setBrandId={setBrandId}
            selectedBrand={selectedBrand}
          />
        )}
        {tab === "channels" && (
          <Channels
            api={api}
            brands={brands}
            brandId={brandId}
            setBrandId={setBrandId}
          />
        )}
        {tab === "waadmin" && (
          <WhatsAppAdmin
            api={api}
            brands={brands}
            brandId={brandId}
            setBrandId={setBrandId}
          />
        )}
        {tab === "leads" && (
          <Leads
            api={api}
            brands={brands}
            brandId={brandId}
            setBrandId={setBrandId}
          />
        )}
        {tab === "wainbox" && (
          <WhatsAppInbox
            api={api}
            brands={brands}
            brandId={brandId}
            setBrandId={setBrandId}
          />
        )}
      </main>
    </div>
  );
}
