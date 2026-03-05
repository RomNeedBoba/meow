import React, { useRef, useState, useEffect, useCallback } from "react";
import "./WavePlayer.css";

const BAR_COUNT = 32;

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function normalizeBars(waveform, count) {
  if (!waveform || waveform.length === 0) {
    return Array.from({ length: count }, () => 0.15 + Math.random() * 0.85);
  }

  const bars = [];
  const step = waveform.length / count;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += Math.abs(waveform[j] ?? 0);
    }
    bars.push(sum / (end - start || 1));
  }

  const max = Math.max(...bars, 0.001);
  return bars.map((b) => Math.max(0.12, b / max));
}

export default function WavePlayer({ src, waveform }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const [bars] = useState(() => normalizeBars(waveform, BAR_COUNT));
  const barsRef = useRef(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => {
      setDuration(a.duration || 0);
      setError(false);
    };
    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => setError(true);

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [src]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || error) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().catch(() => setError(true));
      setPlaying(true);
    }
  }, [playing, error]);

  const seek = useCallback((e) => {
    const a = audioRef.current;
    const el = barsRef.current;
    if (!a || !el || !duration) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * duration;
    setCurrentTime(a.currentTime);
  }, [duration]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayTime = playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration);

  return (
    <div className={`wp ${error ? "wp--error" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button className="wp__play" onClick={toggle} disabled={error} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
            <rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="wp__bars" ref={barsRef} onClick={seek}>
        {bars.map((h, i) => {
          const barPct = (i + 0.5) / bars.length;
          const played = barPct <= progress;
          return (
            <span
              key={i}
              className={`wp__bar ${played ? "wp__bar--played" : ""}`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>

      <span className="wp__time">{error ? "err" : displayTime}</span>
    </div>
  );
} 