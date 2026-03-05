import React, { useEffect, useRef, useState } from "react";
import "./TurnstileGate.css";

export default function TurnstileGate({ siteKey, onVerified }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!siteKey) {
      setError("Turnstile site key not configured.");
      return;
    }

    const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    const existingScript = document.querySelector(`script[src="${SCRIPT_SRC}"]`);

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;

      // Prevent duplicate rendering
      if (widgetIdRef.current !== null) return;

      try {
        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            setError("");
            if (onVerified) onVerified(token);
          },
          "error-callback": () => {
            setError("Verification failed. Please try again.");
          },
          "expired-callback": () => {
            setError("Verification expired. Please verify again.");
          },
          theme: "auto",
        });

        widgetIdRef.current = widgetId;
      } catch (e) {
        console.error("Turnstile render failed:", e);
        setError("Failed to load verification.");
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        renderWidget();
      };

      script.onerror = () => {
        setError("Failed to load verification script.");
      };

      document.body.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 200);

      return () => clearInterval(interval);
    }

    // Cleanup when component unmounts
    return () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.warn("Turnstile cleanup error:", e);
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerified]);

  return (
    <div className="turnstile-gate">
      <div className="turnstile-gate__box">
        <div ref={containerRef} className="turnstile-gate__widget"></div>

        <p className="turnstile-gate__hint">
          This verification is to protect against bots.
        </p>

        {error && <p className="turnstile-gate__error">{error}</p>}
      </div>
    </div>
  );
}