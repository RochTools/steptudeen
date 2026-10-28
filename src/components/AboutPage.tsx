import { BookOpen, Compass, Heart, Users, Star, Globe, Shield, Smartphone, Info } from "lucide-react";

// ─── Features Data ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <BookOpen size={20} />,
    title: "Quran Majeed",
    desc: "Urdu translation with beautiful recitation",
    color: "#10b981",
  },
  {
    icon: <BookOpen size={20} />,
    title: "Hadith Books",
    desc: "Sahih Bukhari, Muslim, Tirmizi, Abu Dawood, Ibn Majah, Nasai, Riyad Saliheen, Muwatta Malik, Al-Adab Al-Mufrad",
    color: "#6366f1",
  },
  {
    icon: <Shield size={20} />,
    title: "Hadith Grading",
    desc: "Every hadith marked as Sahih, Da'if or Hasan",
    color: "#f59e0b",
  },
  {
    icon: <Globe size={20} />,
    title: "40+ Languages",
    desc: "Translation in 40+ languages coming soon",
    color: "#3b82f6",
  },
  {
    icon: <Compass size={20} />,
    title: "Qibla Direction",
    desc: "Accurate Kaaba direction wherever you are",
    color: "#ec4899",
  },
  {
    icon: <Heart size={20} />,
    title: "Masnoon Duas",
    desc: "Daily azkar and words of remembrance",
    color: "#ef4444",
  },
  {
    icon: <Star size={20} />,
    title: "Digital Tasbih",
    desc: "Counter with modern features",
    color: "#8b5cf6",
  },
  {
    icon: <Users size={20} />,
    title: "User Profile",
    desc: "Save favourite hadiths, surahs, bookmarks & tasbih count",
    color: "#14b8a6",
  },
  {
    icon: <Smartphone size={20} />,
    title: "Imam Panel",
    desc: "Real-time prayer times, Eid timings & masjid location updates",
    color: "#f97316",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface AboutProps {
  onBack?: () => void;
}

export default function AboutPage({ onBack }: AboutProps) {
  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>

      {/* Hero */}
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
          StepTuDeen
        </h1>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Your complete Islamic companion app.
        </p>
        <span style={{
          display: "inline-block", padding: "4px 14px", borderRadius: 20,
          background: "#eaf2ff", fontSize: 11, fontWeight: 600,
          border: "1px solid #bcd3fb",
        }}>
          Beta Version
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* About Card */}
        <div style={{
          background: "#ffffff", borderRadius: 16, padding: "20px",
          marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid #f1f5f9",
        }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
            About Us
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            StepTuDeen is an Islamic app currently in its experimental phase. Our mission is to
            make authentic Islamic knowledge easily accessible to every Muslim around the world —
            in their own language, at their fingertips.
          </p>
        </div>

        {/* Features */}
        <h3 style={{
          fontSize: 12, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 12, paddingLeft: 4,
        }}>
          App Features
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: "#ffffff", borderRadius: 12, padding: "14px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9",
              }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: f.color + "18", color: f.color,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {f.icon}
              </span>
              <div>
                <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                  {f.title}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Version Footer */}
        <div style={{
          background: "#ffffff", borderRadius: 12, padding: "14px 16px",
          border: "1px solid #f1f5f9", textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            © 2026 StepTuDeen
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            May Allah accept this effort. Ameen
          </p>
        </div>

      </div>
    </div>
  );
}
