import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";

// ─── Config API ───────────────────────────────────────────────────────────────
const API_BASE = "";

const AGENT_THEME = {
  red: "#C8102E",
  redDeep: "#9B0D22",
  redSoft: "#FDEEF1",
  redBorder: "#F5C6CE",
};

const api = {
  chat: async (message) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/agent/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return res.json();
  },
  reset: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/agent/reset/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
  status: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/agent/status/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};

// ─── Suggestions rapides ──────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "📊", label: "Stats CRM", message: "Stats du CRM" },
  { icon: "👤", label: "Prospects chauds", message: "Montre les prospects chauds" },
  { icon: "💼", label: "Pipeline", message: "Aperçu du pipeline" },
  { icon: "📋", label: "Mes tâches", message: "Montre mes tâches en cours" },
];

// ─── Parser la réponse de l'agent ─────────────────────────────────────────────
function parseAgentResponse(response) {
  if (Array.isArray(response)) {
    return response
      .filter((block) => block?.type === "text")
      .map((block) => block.text)
      .join("\n");
  }
  if (typeof response === "string") return response;
  return String(response);
}

// ─── Composant Message ────────────────────────────────────────────────────────
Message.propTypes = {
  msg: PropTypes.shape({
    role: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
  }).isRequired,
};

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
        <span
          style={{
            fontSize: "11px",
            color: "#64748b",
            background: "#f1f5f9",
            padding: "4px 12px",
            borderRadius: "20px",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "16px",
        gap: "10px",
        alignItems: "flex-end",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            background: `linear-gradient(135deg, ${AGENT_THEME.red}, ${AGENT_THEME.redDeep})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(200,16,46,0.28)",
          }}
        >
          🤖
        </div>
      )}

      <div
        style={{
          maxWidth: "72%",
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser
            ? `linear-gradient(135deg, ${AGENT_THEME.red}, ${AGENT_THEME.redDeep})`
            : "#ffffff",
          color: isUser ? "#ffffff" : "#1e293b",
          fontSize: "14px",
          lineHeight: "1.6",
          wordBreak: "break-word",
          boxShadow: isUser ? "0 4px 12px rgba(200,16,46,0.25)" : "0 2px 8px rgba(0,0,0,0.08)",
          border: isUser ? "none" : "1px solid #e2e8f0",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: "4px 0" }}>{children}</p>,
              ul: ({ children }) => (
                <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ol>
              ),
              li: ({ children }) => <li style={{ margin: "3px 0" }}>{children}</li>,
              strong: ({ children }) => (
                <strong style={{ color: "#0f172a", fontWeight: 600 }}>{children}</strong>
              ),
              em: ({ children }) => <em style={{ color: "#475569" }}>{children}</em>,
              code: ({ children }) => (
                <code
                  style={{
                    background: "#f1f5f9",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontFamily: "'DM Mono', monospace",
                    color: AGENT_THEME.red,
                  }}
                >
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre
                  style={{
                    background: "#f1f5f9",
                    padding: "10px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    overflowX: "auto",
                    margin: "8px 0",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {children}
                </pre>
              ),
              h1: ({ children }) => (
                <h1 style={{ fontSize: "16px", fontWeight: 700, margin: "8px 0 4px" }}>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "8px 0 4px" }}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "6px 0 4px" }}>
                  {children}
                </h3>
              ),
              hr: () => (
                <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
              ),
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}

        <div
          style={{
            fontSize: "10px",
            marginTop: "6px",
            opacity: 0.6,
            textAlign: isUser ? "right" : "left",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {msg.time}
        </div>
      </div>

      {isUser && (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            background: "#e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            flexShrink: 0,
          }}
        >
          👤
        </div>
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", marginBottom: "16px" }}>
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "10px",
          background: `linear-gradient(135deg, ${AGENT_THEME.red}, ${AGENT_THEME.redDeep})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          boxShadow: "0 2px 8px rgba(200,16,46,0.28)",
        }}
      >
        🤖
      </div>
      <div
        style={{
          padding: "14px 18px",
          background: "#ffffff",
          borderRadius: "18px 18px 18px 4px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          gap: "5px",
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: AGENT_THEME.red,
              animation: "bounce 1.2s infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function AgentChat() {
  const [messages, setMessages] = useState([
    {
      role: "agent",
      content:
        "Bonjour ! 👋 Je suis votre assistant CRM intelligent.\n\nJe peux ajouter des prospects, gérer vos opportunités, créer des tâches et vous donner les stats en temps réel.\n\nComment puis-je vous aider ?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [redisStatus, setRedisStatus] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      addMessage("system", "⚠️ Token JWT manquant. Veuillez vous authentifier.");
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api
        .status()
        .then((d) => setRedisStatus(d.redis))
        .catch(() => setRedisStatus(false));
    }
  }, []);

  function now() {
    return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function addMessage(role, content) {
    setMessages((prev) => [...prev, { role, content, time: now() }]);
  }

  async function sendFile(file) {
    if (!file || loading) return;

    const token = localStorage.getItem("token");
    if (!token) {
      addMessage("system", "❌ Session expirée.");
      return;
    }

    // Affiche le fichier dans le chat
    addMessage("user", `📎 Fichier envoyé : ${file.name}`);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "message",
        input.trim() || "Analyse ce fichier et effectue les actions nécessaires."
      );

      const res = await fetch(`${API_BASE}/api/agent/file/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      const content = parseAgentResponse(data.response);
      addMessage("agent", content);
      setInput("");
    } catch (err) {
      addMessage("agent", `❌ Erreur : ${err.message}`);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const token = localStorage.getItem("token");
    if (!token) {
      addMessage("system", "❌ Session expirée. Veuillez vous reconnecter.");
      return;
    }

    setInput("");
    addMessage("user", msg);
    setLoading(true);

    try {
      const data = await api.chat(msg);
      // ── Parser correctement la réponse ──
      const content = parseAgentResponse(data.response);
      addMessage("agent", content);
    } catch (err) {
      if (err.message === "Erreur 401") {
        addMessage("system", "❌ Session expirée. Veuillez vous reconnecter.");
        localStorage.removeItem("token");
        setIsAuthenticated(false);
      } else {
        addMessage(
          "agent",
          `❌ Erreur : ${err.message}\n\nVérifiez que Django tourne sur ${API_BASE}`
        );
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleReset() {
    const token = localStorage.getItem("token");
    if (!token) {
      addMessage("system", "❌ Non authentifié. Veuillez vous reconnecter.");
      return;
    }
    if (!window.confirm("Effacer l'historique de conversation ?")) return;
    await api.reset();
    setMessages([
      { role: "system", content: "Historique effacé", time: now() },
      {
        role: "agent",
        content: "Historique effacé ✅ Je suis prêt pour une nouvelle conversation !",
        time: now(),
      },
    ]);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; font-family: 'DM Sans', sans-serif; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .chat-wrapper { display: flex; flex-direction: column; height: 100vh; max-width: 800px; margin: 0 auto; background: #f8fafc; }
        .header { background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .agent-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, ${AGENT_THEME.red}, ${AGENT_THEME.redDeep}); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(200,16,46,0.28); }
        .agent-info h1 { font-size: 16px; font-weight: 600; color: #0f172a; font-family: 'DM Sans', sans-serif; }
        .agent-status { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; font-family: 'DM Mono', monospace; margin-top: 2px; }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
        .auth-status { display: flex; align-items: center; gap: 5px; font-size: 11px; font-family: 'DM Mono', monospace; margin-top: 2px; }
        .btn-reset { padding: 8px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; color: #64748b; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .btn-reset:hover { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
        .messages-area { flex: 1; overflow-y: auto; padding: 24px; scroll-behavior: smooth; }
        .messages-area::-webkit-scrollbar { width: 5px; }
        .messages-area::-webkit-scrollbar-track { background: transparent; }
        .messages-area::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; animation: fadeIn 0.4s ease; }
        .quick-btn { padding: 8px 14px; border-radius: 20px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'DM Sans', sans-serif; transition: all 0.15s; white-space: nowrap; }
        .quick-btn:hover:not(:disabled) { border-color: ${AGENT_THEME.red}; color: ${AGENT_THEME.red}; background: ${AGENT_THEME.redSoft}; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(200,16,46,0.15); }
        .quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .input-area { background: #ffffff; border-top: 1px solid #e2e8f0; padding: 16px 24px; }
        .redis-badge { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #94a3b8; font-family: 'DM Mono', monospace; margin-bottom: 10px; }
        .input-row { display: flex; gap: 10px; align-items: flex-end; }
        .input-box { flex: 1; padding: 12px 16px; border-radius: 14px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #1e293b; resize: none; outline: none; min-height: 48px; max-height: 120px; line-height: 1.5; transition: border-color 0.15s; }
        .input-box:focus { border-color: ${AGENT_THEME.red}; background: #ffffff; box-shadow: 0 0 0 3px rgba(200,16,46,0.08); }
        .input-box::placeholder { color: #94a3b8; }
        .send-btn { width: 48px; height: 48px; border-radius: 14px; border: none; background: linear-gradient(135deg, ${AGENT_THEME.red}, ${AGENT_THEME.redDeep}); color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; box-shadow: 0 4px 12px rgba(200,16,46,0.3); }
        .send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(200,16,46,0.4); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .hint { font-size: 11px; color: #94a3b8; margin-top: 8px; font-family: 'DM Mono', monospace; }
        .msg-animate { animation: fadeIn 0.3s ease; }
      `}</style>

      <div className="chat-wrapper">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <div className="agent-avatar">🤖</div>
            <div className="agent-info">
              <h1>Assistant CRM</h1>
              <div className="agent-status">
                <div className="status-dot" />
                En ligne · Gemini 2.5 Flash
              </div>
              <div className="auth-status">
                {isAuthenticated ? "✅ Authentifié" : "❌ Non authentifié"}
              </div>
            </div>
          </div>
          <button className="btn-reset" onClick={handleReset}>
            🗑️ Réinitialiser
          </button>
        </div>

        {/* Messages */}
        <div className="messages-area">
          <div className="quick-actions">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                className="quick-btn"
                onClick={() => sendMessage(a.message)}
                disabled={loading || !isAuthenticated}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {messages.map((msg, i) => (
            <div key={i} className="msg-animate">
              <Message msg={msg} />
            </div>
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Zone de saisie */}
        <div className="input-area">
          <div className="redis-badge">
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: redisStatus ? "#22c55e" : "#f59e0b",
              }}
            />
            Mémoire : {redisStatus === null ? "…" : redisStatus ? "Redis ✓" : "RAM (temporaire)"}
          </div>
          <div className="input-row">
            {/* Bouton upload fichier */}
            <label
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                border: `1.5px solid ${AGENT_THEME.redBorder}`,
                background: AGENT_THEME.redSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: loading || !isAuthenticated ? "not-allowed" : "pointer",
                opacity: loading || !isAuthenticated ? 0.5 : 1,
                flexShrink: 0,
                fontSize: "18px",
                transition: "all 0.15s",
              }}
              title="Joindre un fichier (Excel, PDF, Word, CSV)"
            >
              📎
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt"
                style={{ display: "none" }}
                disabled={loading || !isAuthenticated}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) sendFile(file);
                  e.target.value = ""; // reset pour permettre re-upload du même fichier
                }}
              />
            </label>

            <textarea
              ref={inputRef}
              className="input-box"
              placeholder={
                isAuthenticated
                  ? "Ex : Ajoute un prospect Ahmed, email ahmed@test.com, entreprise TechTN... ou joins un fichier 📎"
                  : "Veuillez vous authentifier pour utiliser le chat"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={loading || !isAuthenticated}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || !isAuthenticated}
              title="Envoyer (Entrée)"
            >
              {loading ? "⏳" : "↑"}
            </button>
          </div>
          <div className="hint">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</div>
        </div>
      </div>
    </>
  );
}
