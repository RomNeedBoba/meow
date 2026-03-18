import React, { useCallback, useState, useEffect } from "react";
import TurnstileGate from "./components/TurnstileGate";
import Topbar from "./components/Topbar";
import TTSForm from "./components/TTSForm";
import { apiTts } from "./api";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITEKEY;
const WORD_LIMIT = 200;

const TURNSTILE_TTL = 24 * 60 * 60 * 1000;
const MAX_HISTORY = 10; // max entries to persist (prevents localStorage quota issues)

function countWords(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

// ─── Turnstile helpers ───

function loadTurnstile() {
  try {
    const raw = localStorage.getItem("turnstile");
    if (!raw) return "";
    const { token, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      localStorage.removeItem("turnstile");
      return "";
    }
    return token;
  } catch {
    return "";
  }
}

function saveTurnstile(token) {
  localStorage.setItem(
    "turnstile",
    JSON.stringify({ token, expiry: Date.now() + TURNSTILE_TTL })
  );
}

// ─── Audio helpers ───

async function blobUrlToBase64(blobUrl) {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── History persistence ───

function loadHistory() {
  try {
    const raw = localStorage.getItem("tts_history");
    if (!raw) return [];
    const history = JSON.parse(raw);
    return history.map((r) => ({
      ...r,
      loading: false,
      // Restore audioUrl from the persisted base64 data URI
      audioUrl: r.audioData || null,
    }));
  } catch {
    return [];
  }
}

function saveHistory(results) {
  try {
    const completed = results.filter((r) => !r.loading);
    // Keep only the last N entries to avoid hitting localStorage limits
    const trimmed = completed.slice(-MAX_HISTORY);
    const toSave = trimmed.map(({ text, waveform, error, audioData }) => ({
      text,
      waveform: waveform || null,
      error: error || null,
      audioData: audioData || null,
    }));
    localStorage.setItem("tts_history", JSON.stringify(toSave));
  } catch (e) {
    console.warn("Failed to save TTS history:", e);
    // If quota exceeded, keep fewer entries and retry
    if (e.name === "QuotaExceededError") {
      try {
        const fallback = results.slice(-3).map(({ text, waveform, error, audioData }) => ({
          text,
          waveform: waveform || null,
          error: error || null,
          audioData: audioData || null,
        }));
        localStorage.setItem("tts_history", JSON.stringify(fallback));
      } catch {
        localStorage.removeItem("tts_history");
      }
    }
  }
}

// ─── Main App ───

export default function App() {
  const [token, setToken] = useState(() => loadTurnstile());
  const [language, setLanguage] = useState("km");

  const [text, setText] = useState("");
  const [model, setModel] = useState("Model v1");
  const [voice, setVoice] = useState("Sokriya");
  const [format, setFormat] = useState("wav");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(() => loadHistory());
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const wordCount = countWords(text);

  const handleVerified = useCallback((t) => {
    setToken(t);
    saveTurnstile(t);
  }, []);

  // Persist completed results whenever they change
  useEffect(() => {
    const completed = results.filter((r) => !r.loading);
    if (completed.length > 0) {
      saveHistory(completed);
    }
  }, [results]);

  const canGenerate =
    !!token && !!text.trim() && !!model && !!voice && !!format &&
    wordCount <= WORD_LIMIT && !loading;

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    const prompt = text.trim();
    setText("");

    const idx = results.length;
    setResults((prev) => [
      ...prev,
      {
        text: prompt,
        loading: true,
        audioUrl: null,
        waveform: null,
        error: null,
        audioData: null,
      },
    ]);
    setLoading(true);

    try {
      const data = await apiTts({ text: prompt, language });

      // Convert blob URL → base64 so it survives page refresh
      let audioData = null;
      try {
        audioData = await blobUrlToBase64(data.audioBlobUrl);
      } catch (e) {
        console.warn("Failed to encode audio to base64:", e);
      }

      setResults((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                loading: false,
                audioUrl: data.audioBlobUrl,
                waveform: data.stage4_waveform,
                audioData,
              }
            : r
        )
      );
    } catch (err) {
      setResults((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, loading: false, error: err.message } : r
        )
      );
    } finally {
      setLoading(false);
    }
  }, [canGenerate, text, results.length, language]);

  const onRegenerate = useCallback(
    async (targetIdx) => {
      const idx = targetIdx ?? results.length - 1;
      if (idx < 0) return;
      const entry = results[idx];

      setResults((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                loading: true,
                error: null,
                audioUrl: null,
                waveform: null,
                audioData: null,
              }
            : r
        )
      );
      setLoading(true);

      try {
        const data = await apiTts({ text: entry.text, language });

        // Convert blob URL → base64 so it survives page refresh
        let audioData = null;
        try {
          audioData = await blobUrlToBase64(data.audioBlobUrl);
        } catch (e) {
          console.warn("Failed to encode audio to base64:", e);
        }

        setResults((prev) =>
          prev.map((r, i) =>
            i === idx
              ? {
                  ...r,
                  loading: false,
                  audioUrl: data.audioBlobUrl,
                  waveform: data.stage4_waveform,
                  audioData,
                }
              : r
          )
        );
      } catch (err) {
        setResults((prev) =>
          prev.map((r, i) =>
            i === idx ? { ...r, loading: false, error: err.message } : r
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [results, language]
  );

  const onDownload = useCallback(
    (idx) => {
      const entry = results[idx];
      if (!entry?.audioUrl) return;
      const a = document.createElement("a");
      a.href = entry.audioUrl;
      a.download = `tts-${language}-${idx + 1}.wav`;
      a.click();
    },
    [results, language]
  );

  if (!token) {
    return <TurnstileGate siteKey={SITE_KEY} onVerified={handleVerified} />;
  }

  return (
    <div className="app-shell">
      <Topbar
        language={language}
        setLanguage={setLanguage}
        onFeedbackOpen={() => setFeedbackOpen(true)}
      />

      <div className="content-stack">
        <TTSForm
          text={text}
          setText={setText}
          model={model}
          setModel={setModel}
          voice={voice}
          setVoice={setVoice}
          format={format}
          setFormat={setFormat}
          wordCount={wordCount}
          wordLimit={WORD_LIMIT}
          loading={loading}
          canGenerate={canGenerate}
          onGenerate={generate}
          results={results}
          onRegenerate={onRegenerate}
          onDownload={onDownload}
          language={language}
        />
      </div>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

// ─── Feedback Modal ───

function FeedbackModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  React.useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      setStatus("Please fill in both fields.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });
      if (!res.ok) throw new Error("Failed.");
      setStatus("Thank you!");
      setEmail("");
      setMessage("");
      setTimeout(() => {
        onClose();
        setStatus("");
      }, 800);
    } catch {
      setStatus("Could not send. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fb-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fb-modal">
        <div className="fb-head">
          <h3>Feedback</h3>
          <button className="fb-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form className="fb-form" onSubmit={submit}>
          <label className="fb-label">Email</label>
          <input
            className="fb-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="fb-label">Message</label>
          <textarea
            className="fb-textarea"
            placeholder="Your feedback..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
          />
          {status && <p className="fb-status">{status}</p>}
          <button className="fb-submit" type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
