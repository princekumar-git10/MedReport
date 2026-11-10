import { useState, useEffect, useRef } from "react";
import { BOT_TRANSLATIONS, processHealthQuery } from "../utils/multilingualBot";
import { useLanguage } from "../context/LanguageContext";

export default function HealthBot({ results = [], initialQuery = "" }) {
  const { lang, setLang, t, languages } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModel, setActiveModel] = useState("mistralai/mistral-saba");
  const [lastFailedQuery, setLastFailedQuery] = useState(null);

  const messagesEndRef = useRef(null);
  const chatStreamRef = useRef(null);
  const isInitialMount = useRef(true);
  const recognitionRef = useRef(null);
  const abortControllerRef = useRef(null);

  const tr = BOT_TRANSLATIONS[lang] || BOT_TRANSLATIONS.en;
  const currentLangObj = languages.find((l) => l.code === lang) || languages[0];

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      setSpeechSupported(true);
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSendMessage(transcript);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, [lang]);

  // Initial welcome message
  useEffect(() => {
    const welcomeText =
      tr.greeting +
      (results.length > 0
        ? `\n\n` + t("bot.loadedMarkersMsg", { count: results.length })
        : `\n\n${tr.noReport}`);

    setMessages([
      {
        id: "m_welcome",
        sender: "bot",
        text: welcomeText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isWelcome: true,
      },
    ]);
  }, [lang, results.length]);

  // Handle passed initial query
  useEffect(() => {
    if (initialQuery) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery]);

  // Auto scroll to latest message smoothly
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTo({
        top: chatStreamRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isGenerating]);

  const handleToggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = currentLangObj.voiceLang || "en-IN";
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Mic start error:", e);
      }
    }
  };

  const handleSpeakText = (text, idx) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    if (speakingIndex === idx) {
      setSpeakingIndex(null);
      return;
    }

    const cleanText = text.replace(/[*#_•]/g, " ").replace(/\n+/g, ". ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = currentLangObj.voiceLang || "en-IN";
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(idx);
    window.speechSynthesis.speak(utterance);
  };

  // Clear conversation / New Chat
  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    window.speechSynthesis?.cancel();
    setSpeakingIndex(null);
    setIsGenerating(false);
    setLastFailedQuery(null);

    const welcomeText =
      tr.greeting +
      (results.length > 0
        ? `\n\n` + t("bot.loadedMarkersMsg", { count: results.length })
        : `\n\n${tr.noReport}`);

    setMessages([
      {
        id: "m_welcome_" + Date.now(),
        sender: "bot",
        text: welcomeText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isWelcome: true,
      },
    ]);
  };

  // Send message to OpenRouter via serverless backend
  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isGenerating) return;

    const userMsg = {
      id: "u_" + Date.now(),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const botMsgId = "b_" + Date.now();
    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);
    if (!textToSend) setInput("");
    setIsGenerating(true);
    setLastFailedQuery(null);

    // Prepare report context
    const reportContext = results.map((r) => ({
      name: r.test?.name || r.name,
      value: r.value,
      unit: r.test?.unit || r.unit,
      status: r.status,
      low: r.test?.low,
      high: r.test?.high,
    }));

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // 1. Attempt Streaming Response from /api/chat
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
          reportContext,
          language: lang,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      // Check if response is an SSE stream
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        // Add empty bot placeholder
        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            sender: "bot",
            text: "",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isStreaming: true,
          },
        ]);

        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const jsonStr = trimmed.slice(6);
                if (jsonStr === "[DONE]") break;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const delta = parsed.choices?.[0]?.delta?.content || "";
                  accumulatedText += delta;

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === botMsgId ? { ...m, text: accumulatedText } : m
                    )
                  );
                } catch {
                  // Incomplete JSON chunk, skip
                }
              }
            }
          }
        }

        // Finalize streaming
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, text: accumulatedText || processHealthQuery(query, results, lang), isStreaming: false }
              : m
          )
        );
      } else {
        // Fallback to JSON response
        const data = await response.json();
        const botReply = data.reply || processHealthQuery(query, results, lang);
        if (data.model) setActiveModel(data.model);

        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            sender: "bot",
            text: botReply,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn("API error, falling back to local clinical engine:", err);

      // Graceful offline fallback + retry support
      const offlineReply = processHealthQuery(query, results, lang);
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: "bot",
          text: offlineReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isFallback: true,
          failedQuery: query,
        },
      ]);
      setLastFailedQuery(query);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedQuery) {
      handleSendMessage(lastFailedQuery);
    }
  };

  return (
    <div className="healthbot-console">
      {/* ── Top Bar with Language Dial, Model Tag, and New Chat ── */}
      <div className="bot-top-bar">
        <div className="bot-identity">
          <div className="bot-avatar-orb">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="bot-svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span className="bot-online-beacon" />
          </div>
          <div>
            <div className="bot-name-row">
              <h3 className="bot-title">{t("bot.title")}</h3>
              <span className="bot-engine-badge">OpenRouter • Mistral Saba</span>
            </div>
            <span className="bot-status-text">{t("bot.statusText")}</span>
          </div>
        </div>

        <div className="bot-top-actions">
          {/* New Chat Button */}
          <button
            className="bot-new-chat-btn"
            onClick={handleNewChat}
            title={t("bot.newChat")}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            <span>{t("bot.newChat")}</span>
          </button>

          {/* Language Selection Dial */}
          <div className="bot-lang-group">
            <span className="lang-icon">🌐</span>
            <select
              className="bot-lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label={t("bot.selectLang")}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Status Banner ── */}
      <div className="bot-offline-strip">
        <span className="strip-pip" />
        <span>{t("bot.offlineNotice")}</span>
      </div>

      {/* ── Conversation Message Flow ── */}
      <div className="bot-chat-stream" ref={chatStreamRef}>
        {messages.map((m, idx) => {
          const isBot = m.sender === "bot";
          const isSpeaking = speakingIndex === idx;

          return (
            <div key={m.id} className={`chat-bubble-row ${isBot ? "bot-row" : "user-row"}`}>
              {isBot && (
                <div className="msg-bot-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </div>
              )}
              <div className={`chat-bubble ${isBot ? "bot-bubble" : "user-bubble"}`}>
                <div className="bubble-content">
                  {m.text ? (
                    m.text.split("\n").map((line, i) => (
                      <p key={i} className="bubble-line">
                        {line.startsWith("###") ? (
                          <strong className="line-h3">{line.replace("###", "")}</strong>
                        ) : line.startsWith("•") || line.startsWith("*") ? (
                          <span className="line-bullet">{line}</span>
                        ) : (
                          line
                        )}
                      </p>
                    ))
                  ) : (
                    <div className="bot-typing-dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  )}
                </div>

                <div className="bubble-meta">
                  <span className="bubble-time">{m.time}</span>

                  {isBot && m.text && (
                    <button
                      className={`voice-listen-btn ${isSpeaking ? "speaking" : ""}`}
                      onClick={() => handleSpeakText(m.text, idx)}
                      title={t("bot.readAloud")}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="voice-icon">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                      </svg>
                      <span>{isSpeaking ? t("bot.speaking") : t("bot.listen")}</span>
                    </button>
                  )}

                  {m.isFallback && (
                    <button className="bot-retry-btn" onClick={handleRetry} title={t("bot.retryBtn")}>
                      <span>↻ {t("bot.retryBtn")}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Global Typing indicator if waiting for initial chunk */}
        {isGenerating && (!messages[messages.length - 1] || messages[messages.length - 1]?.sender === "user") && (
          <div className="chat-bubble-row bot-row">
            <div className="msg-bot-icon">🤖</div>
            <div className="chat-bubble bot-bubble typing-bubble">
              <div className="bot-typing-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              <span className="typing-text">{t("bot.typing")}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Suggested Inquiries Pill Carousel ── */}
      <div className="bot-prompt-chips">
        <span className="chips-label">{t("bot.suggested")}</span>
        <div className="chips-scroll">
          {tr.samplePrompts?.map((p, i) => (
            <button key={i} className="prompt-chip" onClick={() => handleSendMessage(p)} disabled={isGenerating}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input Bar with Voice Mic & Send Button ── */}
      <div className="bot-input-dock">
        {speechSupported && (
          <button
            className={`bot-mic-btn ${isListening ? "listening" : ""}`}
            onClick={handleToggleMic}
            title={isListening ? t("bot.micListening") : t("bot.micClick")}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="mic-svg">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            {isListening && <span className="mic-wave" />}
          </button>
        )}

        <input
          type="text"
          className="bot-text-input"
          placeholder={t("bot.inputPlaceholder", { lang: currentLangObj.native })}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          disabled={isGenerating}
        />

        <button
          className="bot-send-btn"
          onClick={() => handleSendMessage()}
          disabled={!input.trim() || isGenerating}
          title={t("bot.sendInquiry")}
          type="button"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="send-svg">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
