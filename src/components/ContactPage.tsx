import { Mail, Youtube, MessageCircle, Send, Facebook, Linkedin } from "lucide-react";
import { useState } from "react";

// ─── WhatsApp Icon ────────────────────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── TikTok Icon ──────────────────────────────────────────────────────────────
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

// ─── Contact Links ────────────────────────────────────────────────────────────
const CONTACT_LINKS = [
  {
    id: "email",
    label: "Email Us",
    value: "steptodeen@gmail.com",
    url: "mailto:steptodeen@gmail.com",
    color: "#6366f1",
    icon: <Mail size={20} />,
    badge: "Support",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Channel",
    value: "Join our channel",
    url: "https://whatsapp.com/channel/0029VbAs3L2HAdNarzPISZ2z",
    color: "#25D366",
    icon: <WhatsAppIcon />,
    badge: "Follow",
  },
  {
    id: "youtube",
    label: "YouTube",
    value: "@steptudeen",
    url: "https://www.youtube.com/@steptudeen",
    color: "#FF0000",
    icon: <Youtube size={20} />,
    badge: "Subscribe",
  },
  {
    id: "tiktok",
    label: "TikTok",
    value: "@steptudeen",
    url: "https://www.tiktok.com/@steptudeen",
    color: "#010101",
    icon: <TikTokIcon />,
    badge: "Follow",
  },
  // ─── NEW: Facebook ─────────────────────────────────────────────────────
  {
    id: "facebook",
    label: "Facebook",
    value: "@steptudeen",
    url: "https://www.facebook.com/steptudeen",
    color: "#1877F2",
    icon: <Facebook size={20} />,
    badge: "Follow",
  },
  // ─── NEW: LinkedIn ─────────────────────────────────────────────────────
  {
    id: "linkedin",
    label: "LinkedIn",
    value: "@steptudeen",
    url: "https://www.linkedin.com/in/steptudeen",
    color: "#0A66C2",
    icon: <Linkedin size={20} />,
    badge: "Follow",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ContactProps {
  onBack?: () => void;
}

export default function ContactPage({ onBack }: ContactProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSend() {
    if (!name.trim() || !message.trim()) return;
    const subject = encodeURIComponent(`Feedback from ${name} — StepToDeen`);
    const body = encodeURIComponent(`Name: ${name}\n\nMessage:\n${message}`);
    window.open(`mailto:steptodeen@gmail.com?subject=${subject}&body=${body}`, "_blank");
    setSent(true);
    setName("");
    setMessage("");
    setTimeout(() => setSent(false), 4000);
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
        <h1 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px" }}>Contact Us</h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Your feedback helps us improve StepTuDeen.
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* Contact Links */}
        <h3 style={{
          fontSize: 12, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 12, paddingLeft: 4,
        }}>
          Reach Us On
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {CONTACT_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 12px", borderRadius: 12, textDecoration: "none",
                background: "#ffffff", border: "1px solid #f1f5f9",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: link.color, color: "#ffffff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {link.icon}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                  {link.label}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{link.value}</p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: link.color,
                background: link.color + "15",
                padding: "3px 9px", borderRadius: 20,
              }}>
                {link.badge}
              </span>
            </a>
          ))}
        </div>

        {/* Feedback Form */}
        <h3 style={{
          fontSize: 12, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 12, paddingLeft: 4,
        }}>
          Send Feedback
        </h3>

        <div style={{
          background: "#ffffff", borderRadius: 16, padding: "16px",
          border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          {sent && (
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "8px 12px", marginBottom: 12,
              fontSize: 13, color: "#16a34a", fontWeight: 500,
            }}>
               Email client opened! Thank you for your feedback.
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b",
                outline: "none", boxSizing: "border-box",
                background: "#f8fafc",
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>
              Message / Suggestions
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share your feedback, suggestions or report an issue..."
              rows={4}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b",
                outline: "none", resize: "vertical", boxSizing: "border-box",
                background: "#f8fafc", fontFamily: "system-ui, sans-serif",
              }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!name.trim() || !message.trim()}
            style={{
              width: "100%", padding: "12px",
              borderRadius: 10, border: "none",
              background: name.trim() && message.trim()
                ? "linear-gradient(145deg, #3b82f6, #1d5fd6)"
                : "#e2e8f0",
              color: name.trim() && message.trim() ? "#ffffff" : "#94a3b8",
              fontSize: 14, fontWeight: 600, cursor: name.trim() && message.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Send size={16} />
            Send Feedback
          </button>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 20 }}>
          🤲 JazakAllah Khair for your time and support
        </p>

      </div>
    </div>
  );
}
