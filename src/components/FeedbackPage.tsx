import { useState } from "react";
import { MessageSquare, Send, ChevronDown } from "lucide-react";

interface FeedbackProps {
  onBack?: () => void;
}

const CATEGORIES = [
  { label: "Quran Majeed",     subject: "Feedback: Quran Majeed" },
  { label: "Hadith",           subject: "Feedback: Hadith" },
  { label: "Masnoon Duas",     subject: "Feedback: Masnoon Duas" },
  { label: "Namaz / Prayer",   subject: "Feedback: Namaz / Prayer Times" },
  { label: "Tasbih",           subject: "Feedback: Digital Tasbih" },
  { label: "Qibla",            subject: "Feedback: Qibla Direction" },
  { label: "User Account",     subject: "Feedback: User Account" },
  { label: "Imam Account",     subject: "Feedback: Imam Account" },
  { label: "Imam Panel",       subject: "Feedback: Imam Panel" },
  { label: "App General",      subject: "Feedback: General App" },
  { label: "Bug Report",       subject: "Bug Report: StepTuDeen" },
  { label: "Suggestion",       subject: "Suggestion: StepTuDeen" },
  { label: "Other",            subject: "Feedback: Other" },
];

export default function FeedbackPage({ onBack }: FeedbackProps) {
  const [categoryIndex, setCategoryIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);

  const selected = categoryIndex !== null ? CATEGORIES[categoryIndex] : null;
  const canSubmit = selected && name.trim() && body.trim();

  function handleSubmit() {
    if (!canSubmit) return;
    const subject = encodeURIComponent(`${selected.subject} — ${name}`);
    const bodyText = encodeURIComponent(`Name: ${name}\nCategory: ${selected.label}\n\nMessage:\n${body}`);
    window.open(`mailto:steptodeen@gmail.com?subject=${subject}&body=${bodyText}`, "_blank");
  }

  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#ffffff",
        padding: "14px 16px", borderBottom: "1px solid #e2e8f0",
        textAlign: "center",
        color: "#0b1f4d",
        position: "relative",
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            position: "absolute", top: "50%", transform: "translateY(-50%)", left: 12,
            background: "#2563eb", border: "none",
            color: "#fff", borderRadius: 10, padding: "8px 14px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            ← Back
          </button>
        )} 
        <h1 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px" }}>
          Feedback
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Tell us what can be improved
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>
        <div style={{
          background: "#ffffff", borderRadius: 16, padding: "18px",
          border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>

          {/* Category Dropdown */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Category
            </label>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setOpen(p => !p)}
                style={{
                  width: "100%", padding: "10px 12px",
                  borderRadius: 10, border: "1px solid #e2e8f0",
                  background: "#f8fafc", fontSize: 13,
                  color: selected ? "#1e293b" : "#94a3b8",
                  textAlign: "left", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                {selected ? selected.label : "Select a category"}
                <ChevronDown size={16} color="#94a3b8" />
              </button>

              {open && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "#ffffff", borderRadius: 12,
                  border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  zIndex: 10, overflow: "hidden",
                }}>
                  {CATEGORIES.map((cat, i) => (
                    <button
                      key={i}
                      onClick={() => { setCategoryIndex(i); setOpen(false); }}
                      style={{
                        width: "100%", padding: "11px 14px",
                        background: categoryIndex === i ? "#f0fdf4" : "transparent",
                        border: "none", borderBottom: i < CATEGORIES.length - 1 ? "1px solid #f1f5f9" : "none",
                        textAlign: "left", fontSize: 13,
                        color: categoryIndex === i ? "#2563eb" : "#1e293b",
                        fontWeight: categoryIndex === i ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subject Preview */}
          {selected && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Subject
              </label>
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                border: "1px solid #e2e8f0", background: "#f1f5f9",
                fontSize: 13, color: "#475569",
              }}>
                {selected.subject}
              </div>
            </div>
          )}

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b",
                outline: "none", boxSizing: "border-box", background: "#f8fafc",
              }}
            />
          </div>

          {/* Message */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe your feedback in detail..."
              rows={5}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b",
                outline: "none", resize: "vertical", boxSizing: "border-box",
                background: "#f8fafc", fontFamily: "system-ui, sans-serif",
              }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%", padding: "13px",
              borderRadius: 10, border: "none",
              background: canSubmit
                ? "linear-gradient(145deg, #3b82f6, #1d5fd6)"
                : "#e2e8f0",
              color: canSubmit ? "#ffffff" : "#94a3b8",
              fontSize: 14, fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Send size={16} />
            Send Feedback
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 20 }}>
          Your feedback is sent directly to steptodeen@gmail.com
        </p>
      </div>
    </div>
  );
}
