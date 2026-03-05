import React, { useEffect, useRef, useState, useMemo } from "react";
import WavePlayer from "./WavePlayer";
import { getGreeting, PLACEHOLDERS } from "../utils/greetings";
import "./TTSForm.css";

const MODEL_OPTIONS = [
  { value: "Model v1", label: "Model v1", enabled: true },
  { value: "Model v2", label: "Model v2", enabled: false },
];

const VOICE_OPTIONS = [
  { value: "Sokriya", label: "Sokriya", enabled: true },
  { value: "Sophea", label: "Sophea", enabled: false },
  { value: "Visal", label: "Visal", enabled: false },
];

const FORMAT_OPTIONS = [
  { value: "wav", label: "WAV", enabled: true },
  { value: "mp3", label: "MP3", enabled: true },
];

function InlineSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="isel" ref={ref}>
      <button type="button" className="isel-btn" onClick={() => setOpen((v) => !v)}>
        {selected?.label || "—"}
        <svg className={`isel-icon ${open ? "is-up" : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="isel-list">
          {options.map((o) => (
            <li
              key={o.value}
              className={`isel-item ${o.value === value ? "is-active" : ""} ${!o.enabled ? "is-disabled" : ""}`}
              onClick={() => {
                if (!o.enabled) return;
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {!o.enabled && <span className="isel-soon">soon</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function wavBlobToMp3Blob(wavBlob) {
  // Decode WAV using Web Audio API
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await wavBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  audioCtx.close();

  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0); // float32 mono

  // Convert float32 → Int16
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s * 32767;
  }

  // Encode to MP3
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const mp3Data = [];
  const blockSize = 1152;

  for (let i = 0; i < int16.length; i += blockSize) {
    const chunk = int16.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) mp3Data.push(buf);
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  return new Blob(mp3Data, { type: "audio/mp3" });
}

export default function TTSForm({
  text, setText, model, setModel, voice, setVoice,
  format, setFormat, wordCount, wordLimit, loading,
  canGenerate, onGenerate, results, onRegenerate, onDownload,
  language,
}) {
  const isOver = wordCount > wordLimit;
  const hasResults = results && results.length > 0;
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [converting, setConverting] = useState(false);

  const greeting = useMemo(() => {
    return getGreeting(language);
  }, [language]);

  const placeholder = PLACEHOLDERS[language] || PLACEHOLDERS.en;

  useEffect(() => {
    if (hasResults) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [results, hasResults]);

  const handleInput = (e) => {
    setText(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  };

  const submit = () => {
    if (!canGenerate) return;
    onGenerate();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const handleDownload = async (idx) => {
    const entry = results[idx];
    if (!entry?.audioUrl) return;

    if (format === "mp3") {
      try {
        setConverting(true);
        const wavRes = await fetch(entry.audioUrl);
        const wavBlob = await wavRes.blob();
        const mp3Blob = await wavBlobToMp3Blob(wavBlob);
        const mp3Url = URL.createObjectURL(mp3Blob);

        const a = document.createElement("a");
        a.href = mp3Url;
        a.download = `tts-${language}-${idx + 1}.mp3`;
        a.click();

        setTimeout(() => URL.revokeObjectURL(mp3Url), 1000);
      } catch (err) {
        console.error("MP3 conversion failed:", err);
        // Fallback to WAV download
        onDownload(idx);
      } finally {
        setConverting(false);
      }
    } else {
      // WAV direct download
      onDownload(idx);
    }
  };

  const lastIndex = results ? results.length - 1 : -1;

  const inputBox = (
    <div className="ib">
      <textarea
        ref={textareaRef}
        className="ib__input"
        placeholder={placeholder}
        value={text}
        onChange={handleInput}
        onKeyDown={onKeyDown}
        rows={2}
      />
      <div className="ib__bar">
        <div className="ib__options">
          <InlineSelect value={model} onChange={setModel} options={MODEL_OPTIONS} />
          <span className="ib__sep" />
          <InlineSelect value={voice} onChange={setVoice} options={VOICE_OPTIONS} />
          <span className="ib__sep" />
          <InlineSelect value={format} onChange={setFormat} options={FORMAT_OPTIONS} />
        </div>
        <div className="ib__right">
          <span className={`ib__count ${isOver ? "is-over" : ""}`}>
            {wordCount}/{wordLimit}
          </span>
          <button
            type="button"
            className="ib__send"
            onClick={submit}
            disabled={!canGenerate}
            aria-label="Generate"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  if (!hasResults) {
    return (
      <main className="tts-empty">
        <div className="tts-empty__wrap">
          <p className="tts-empty__greeting">{greeting}</p>
          {inputBox}
        </div>
      </main>
    );
  }

  return (
    <main className="tts-chat">
      <div className="tts-chat__feed">
        {results.map((r, i) => (
          <div className="tts-thread" key={i}>
            {/* User text — right aligned, pure text */}
            <div className="msg msg--user">
              <p className="msg__text">{r.text}</p>
            </div>

            {/* System response — left aligned */}
            <div className="msg msg--sys">
              {r.loading ? (
                <div className="dots"><span /><span /><span /></div>
              ) : r.error ? (
                <p className="msg__err">{r.error}</p>
              ) : r.audioUrl ? (
                <WavePlayer src={r.audioUrl} waveform={r.waveform} />
              ) : (
                <p className="msg__expired">
                  {language === "km" ? "សម្លេងផុតកំណត់ — ចុចបង្កើតឡើងវិញ។" :
                   language === "zh" ? "音频已过期 — 点击重新生成。" :
                   language === "fr" ? "Audio expiré — cliquez pour régénérer." :
                   "Audio expired — tap regenerate to listen again."}
                </p>
              )}
              {!r.loading && (
                <div className="msg__acts">
                  {(r.error || !r.audioUrl || i === lastIndex) && (
                    <button
                      className="act-btn"
                      onClick={() => onRegenerate(i)}
                      disabled={loading}
                      title="Regenerate"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1.75 7a5.25 5.25 0 019.03-3.64M12.25 7a5.25 5.25 0 01-9.03 3.64" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <path d="M10.5 1v2.5H13M3.5 13v-2.5H1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {r.audioUrl && (
                    <button
                      className="act-btn"
                      onClick={() => handleDownload(i)}
                      disabled={converting}
                      title={`Download as ${format.toUpperCase()}`}
                    >
                      {converting ? (
                        <div className="dots" style={{ padding: 0 }}>
                          <span /><span /><span />
                        </div>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M7 1.75v7.5M4 7l3 3 3-3M2.5 12.25h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="tts-dock">
        {inputBox}
      </div>
    </main>
  );
}