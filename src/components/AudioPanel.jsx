import React from "react";
import "./AudioPanel.css";

export default function AudioPanel({ audioUrl }) {
  return (
    <section className="audio-card">
      <h3>Generated audio</h3>
      <audio controls src={audioUrl} className="audio-player">
        Your browser does not support audio.
      </audio>
    </section>
  );
}