import { useEffect } from "react";
import {
  X, ChevronRight, Settings, Info, Shield, Mail,
  FileText, HelpCircle, Share2, Star, MessageSquare,
  LifeBuoy, Youtube, Linkedin, Facebook
} from "lucide-react";

// ─── WhatsApp SVG (lucide میں نہیں ہے) ───────────────────────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── TikTok SVG (lucide میں نہیں ہے) ─────────────────────────────────────────
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

const MENU_ITEMS = [
  { id: "settings",  label: "Settings",         icon: <Settings   size={18} /> },
  { id: "about",     label: "About Us",          icon: <Info       size={18} /> },
  { id: "privacy",   label: "Privacy Policy",    icon: <Shield     size={18} /> },
  { id: "contact",   label: "Contact Us",        icon: <Mail       size={18} /> },
  { id: "terms",     label: "Terms of Service",  icon: <FileText   size={18} /> },
  { id: "faq",       label: "FAQ",               icon: <HelpCircle size={18} /> },
  { id: "ratings",   label: "Ratings",           icon: <Star       size={18} /> },
  { id: "share",     label: "Share App",         icon: <Share2     size={18} /> },
  { id: "feedback",  label: "Feedback",          icon: <MessageSquare size={18} /> },
  { id: "help",      label: "Help Center",       icon: <LifeBuoy   size={18} /> },
];

const SOCIAL_LINKS = [
  {
    id: "whatsapp",
    label: "WhatsApp Channel",
    url: "https://whatsapp.com/channel/0029VbAs3L2HAdNarzPISZ2z",
    color: "#25D366",
    icon: <WhatsAppIcon />,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/steptudeen",
    color: "#0A66C2",
    icon: <Linkedin size={18} />,
  },
  {
    id: "facebook",
    label: "Facebook",
    url: "https://facebook.com/steptudeen",
    color: "#1877F2",
    icon: <Facebook size={18} />,
  },
  {
    id: "youtube",
    label: "YouTube",
    url: "https://youtube.com/@steptudeen",
    color: "#FF0000",
    icon: <Youtube size={18} />,
  },
  {
    id: "tiktok",
    label: "TikTok",
    url: "https://tiktok.com/@steptudeen.pk",
    color: "#010101",
    icon: <TikTokIcon />,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (view: string) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FullScreenMenu({ onNavigate, onClose }: Props) {

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .menu-item:hover { background: #f1f5f9 !important; }
        .social-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(15, 23, 42, 0.5)",
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "100%", maxWidth: 400,
          zIndex: 9999,
          background: "#ffffff",
          animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex", flexDirection: "column",
          boxShadow: "-4px 0 30px rgba(0,0,0,0.15)",
          direction: "ltr",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 16px 12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Menu</h2>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              background: "#f1f5f9", color: "#64748b", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 12px 20px" }}>

          {/* Menu Items */}
          <div style={{ marginBottom: 8 }}>
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                className="menu-item"
                onClick={() => { onNavigate(item.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "12px 14px",
                  border: "none", borderRadius: 10, background: "transparent",
                  cursor: "pointer", textAlign: "left",
                  fontSize: 14, fontWeight: 500, color: "#334155",
                  transition: "background 0.12s ease",
                  direction: "ltr",
                }}
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: "#f1f5f9", color: "#475569",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ color: "#cbd5e1" }}><ChevronRight size={16} /></span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#f1f5f9", margin: "4px 14px 16px" }} />

          {/* Social Media */}
          <div style={{ padding: "0 6px" }}>
            <h3 style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 10, paddingLeft: 8,
            }}>
              Follow Us On Social Media
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, textDecoration: "none",
                    background: "#f8fafc", border: "1px solid #f1f5f9",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: link.color, color: "#ffffff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {link.icon}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    {link.label}
                  </span>
                  <span style={{
                    fontSize: 12, color: "#94a3b8", background: "#f1f5f9",
                    padding: "4px 10px", borderRadius: 20, fontWeight: 500,
                  }}>
                    {link.id === "youtube" ? "Subscribe" : "Follow"}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Extra Info */}
          <div style={{
            marginTop: 20, padding: "12px 14px",
            background: "#f8fafc", borderRadius: 12, border: "1px solid #f1f5f9",
          }}>
            <p style={{
              fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: 0, textAlign: "center",
            }}>
              Your feedback helps us improve StepTuDeen. JazakAllah Khair for your time and support
            </p>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid #f1f5f9",
          textAlign: "center", fontSize: 11, color: "#94a3b8", flexShrink: 0,
        }}>
          © 2026 StepTuDeen
       _V3.0.0 </div>
      </div>
    </>
  );
}
