import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const newSessionId = () => crypto.randomUUID();

const postJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
};

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [sessionId, setSessionId] = useState(newSessionId);
  const [conversations, setConversations] = useState([]);
  const [documents, setDocuments] = useState([]);

  const endOfMessagesRef = useRef(null);
  const fileInputRef = useRef(null);

  const refreshConversations = async () => {
    try {
      setConversations(await postJson(`${API}/api/conversations`));
    } catch {
      /* la barre latérale reste vide si le serveur est indisponible */
    }
  };

  const refreshDocuments = async () => {
    try {
      setDocuments(await postJson(`${API}/api/documents`));
    } catch {
      /* idem */
    }
  };

  useEffect(() => {
    refreshConversations();
    refreshDocuments();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);

    try {
      const data = await postJson(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId }),
      });
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.answer, sources: data.sources ?? [] },
      ]);
      refreshConversations();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `⚠️ ${err?.message ?? "Chat request failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const data = await postJson(`${API}/api/ingest`, { method: "POST", body: formData });
      setUploadStatus(`✅ ${selectedFile.name} indexé (${data.chunks} extraits). Vous pouvez poser vos questions.`);
      setSelectedFile(null);
      refreshDocuments();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadStatus(`⚠️ ${err?.message ?? "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setSessionId(newSessionId());
  };

  const openConversation = async (id) => {
    if (loading || id === sessionId) return;
    try {
      const convo = await postJson(`${API}/api/conversations/${id}`);
      setSessionId(id);
      setMessages(
        convo.messages.map((m) => ({ role: m.role, text: m.text, sources: m.sources ?? [] }))
      );
    } catch (err) {
      setUploadStatus(`⚠️ ${err?.message}`);
    }
  };

  const removeConversation = async (id) => {
    if (!window.confirm("Supprimer cette conversation ?")) return;
    try {
      await postJson(`${API}/api/conversations/${id}`, { method: "DELETE" });
      if (id === sessionId) resetChat();
      refreshConversations();
    } catch (err) {
      setUploadStatus(`⚠️ ${err?.message}`);
    }
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="appHeaderInner headerRow">
          <div>
            <div className="appTitle">Agentic Personal Assistant</div>
            <div className="appSubtitle">Importez des PDF, puis discutez avec votre base de connaissances.</div>
          </div>
        </div>
      </header>

      <main className="appMain">
        <aside className="sidebar">
          <button className="primaryButton" onClick={resetChat} disabled={loading}>
            + Nouvelle conversation
          </button>
          <div className="sidebarTitle">Historique</div>
          <div className="convoList">
            {conversations.length === 0 && <div className="sidebarEmpty">Aucune conversation</div>}
            {conversations.map((c) => (
              <div key={c.sessionId} className={`convoItem${c.sessionId === sessionId ? " isActive" : ""}`}>
                <button className="convoOpen" onClick={() => openConversation(c.sessionId)} title={c.title}>
                  {c.title}
                </button>
                <button className="convoDelete" onClick={() => removeConversation(c.sessionId)} title="Supprimer">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="content">
          <section className="uploadPanel">
            <div className="uploadRow">
              <label className="uploadButton" htmlFor="pdf-upload">Choisir un PDF</label>
              <input
                ref={fileInputRef}
                id="pdf-upload"
                className="uploadInput"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <button className="primaryButton" onClick={uploadDocument} disabled={!selectedFile || uploading}>
                {uploading ? "Indexation…" : "Importer"}
              </button>
              <div className="uploadMeta">{selectedFile ? selectedFile.name : "Aucun fichier sélectionné"}</div>
            </div>
            {uploadStatus && <div className="uploadStatus">{uploadStatus}</div>}
            {documents.length > 0 && (
              <ul className="docList">
                {documents.map((d) => (
                  <li key={d.name}>
                    📄 {d.name} <span>· {d.chunks} extraits</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="chatPanel">
            <div className="messages">
              {messages.length === 0 && (
                <div className="emptyState">Importez un PDF, puis posez une question ci-dessous.</div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "messageRow isUser" : "messageRow isAi"}>
                  <div className="messageBubble">
                    {m.role === "ai" ? <ReactMarkdown>{m.text}</ReactMarkdown> : m.text}
                    {m.sources?.length > 0 && (
                      <div className="sources">
                        Sources : {m.sources.map((s) => [s.source, s.page && `p.${s.page}`].filter(Boolean).join(" ")).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="messageRow isAi">
                  <div className="messageBubble isTyping">Recherche et rédaction…</div>
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>

            <div className="composer">
              <div className="composerInner">
                <textarea
                  className="composerInput"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Posez une question sur vos documents…"
                  rows={1}
                />
                <button className="sendButton" onClick={sendMessage} disabled={loading || !input.trim()}>
                  Envoyer
                </button>
              </div>
              <div className="composerHint">Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;