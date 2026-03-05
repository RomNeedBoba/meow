import React, { useEffect, useState } from "react";
import "./Header.css";
import logo from "../../public/IDRI.png";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!feedbackOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setFeedbackOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [feedbackOpen]);

  const submitFeedback = async (e) => {
    e.preventDefault();
    setStatus("");

    if (!email.trim() || !message.trim()) {
      setStatus("Please fill in your email and message.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });

      if (!res.ok) throw new Error("Failed to submit feedback.");
      setStatus("Thank you! Feedback sent.");
      setEmail("");
      setMessage("");
      setTimeout(() => {
        setFeedbackOpen(false);
        setStatus("");
      }, 800);
    } catch (err) {
      setStatus(err.message || "Could not send feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="header">
        <div className="header__left">
          <img src={logo} alt="Logo" className="header__logo" />
        </div>

        <button
          className="header__hamburger"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`header__right ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          <a
            href="https://www.idri.edu.kh/about/"
            target="_blank"
            rel="noopener noreferrer"
            className="header__btn"
            onClick={closeMenu}
          >
            About
          </a>

          <a
            href="https://www.idri.edu.kh/research/"
            target="_blank"
            rel="noopener noreferrer"
            className="header__btn"
            onClick={closeMenu}
          >
            Research
          </a>

          <button
            type="button"
            className="header__btn"
            onClick={() => {
              setFeedbackOpen(true);
              closeMenu();
            }}
          >
            Feedback
          </button>
        </nav>
      </header>

      {feedbackOpen && (
        <div className="feedbackOverlay">
          <div
            className="feedbackModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            <div className="feedbackModal__head">
              <h3 id="feedback-title">Feedback</h3>
              <button
                className="feedbackModal__close"
                onClick={() => setFeedbackOpen(false)}
                aria-label="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <form className="feedbackForm" onSubmit={submitFeedback}>
              <label className="feedbackLabel" htmlFor="fb-email">Your Email</label>
              <input
                id="fb-email"
                type="email"
                className="feedbackInput"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label className="feedbackLabel" htmlFor="fb-message">Message</label>
              <textarea
                id="fb-message"
                className="feedbackTextarea"
                placeholder="Write your feedback..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                required
              />

              {status ? <p className="feedbackStatus">{status}</p> : null}

              <button type="submit" className="feedbackSubmit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Feedback"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}