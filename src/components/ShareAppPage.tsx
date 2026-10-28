import { Share2 } from "lucide-react";

interface ShareAppProps {
  onBack?: () => void;
}

const APP_URL = "https://steptudeen.pages.dev";
const APP_NAME = "StepTuDeen";
const SHARE_MESSAGE = `Check out ${APP_NAME} — A complete Islamic app with Quran, Hadith, Qibla, Duas and much more!\n\n${APP_URL}`;

export default function ShareAppPage({ onBack }: ShareAppProps) {

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: APP_NAME,
          text: SHARE_MESSAGE,
          url: APP_URL,
        });
      } catch (err) {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(APP_URL);
      alert("Link copied to clipboard!");
    }
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
          Share App
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Share StepTuDeen with your family and friends
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px 40px" }}>

        {/* App Info Card */}
        <div style={{
          background: "#ffffff", borderRadius: 16, padding: "24px",
          border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          textAlign: "center", marginBottom: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(145deg, #3b82f6, #1d5fd6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px", fontSize: 30, color: "#ffffff",
          }}>
            ☪
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
            StepTuDeen
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
            A complete Islamic app with Quran, Hadith, Qibla, Masnoon Duas, Digital Tasbih and much more.
          </p>

          {/* URL Box */}
          <div style={{
            background: "#f8fafc", borderRadius: 10, padding: "10px 14px",
            border: "1px solid #e2e8f0", marginBottom: 20,
            fontSize: 12, color: "#475569", wordBreak: "break-all",
          }}>
            {APP_URL}
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            style={{
              width: "100%", padding: "14px",
              borderRadius: 12, border: "none",
              background: "linear-gradient(145deg, #3b82f6, #1d5fd6)",
              color: "#ffffff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Share2 size={18} />
            Share StepTuDeen
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
          Spread the knowledge. May Allah reward you for every person who benefits.
        </p>

      </div>
    </div>
  );
}
