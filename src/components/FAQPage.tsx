import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    category: "Location Permission — Important",
    items: [
      {
        q: "I tapped 'Allow Location' but nothing happened. Why?",
        a: "This happens when your browser has previously blocked location permission for StepTuDeen. Once blocked, the browser will not show the permission popup again automatically. To fix this: open Chrome, go to Settings → Site Settings → Location, find StepTuDeen in the blocked list, and change it to Allow. Then come back to the app and try again.",
      },
      {
        q: "Masjid distances are showing incorrectly or from a different city. Why?",
        a: "This happens when location permission is blocked or turned off. The app needs your current live location to calculate accurate distances. If location is off, no distance will be shown. Please allow location permission from your browser settings to see correct nearby masjids.",
      },
      {
        q: "How do I allow location permission from browser settings on Android?",
        a: "Open Chrome → tap the three-dot menu (top right) → Settings → Site Settings → Location → find https://steptudeen.islamorg.workers.dev/ in the blocked list → tap it → change to Allow. Then reload the app.",
      },
    ],
  },
  {
    category: "Account",
    items: [
      {
        q: "How do I create an account?",
        a: "Open the app and tap on 'Sign Up'. Enter your name, Gmail address, and a password to create your account.",
      },
      {
        q: "I forgot my password. What should I do?",
        a: "On the login screen, tap 'Forgot Password'. A reset link will be sent to your Gmail address.",
      },
      {
        q: "Can I use the app without creating an account?",
        a: "Some features like Quran, Hadith, Qibla, and Duas are available without an account. However, saving favourites, bookmarks, and tasbih history requires an account.",
      },
    ],
  },
  {
    category: "Saved Data & History",
    items: [
      {
        q: "My saved hadiths and tasbih count disappeared. Why?",
        a: "Favourites, bookmarks, and tasbih history are stored in your device's local storage. If you clear the app's cache or data from your phone settings, this information will be deleted. We recommend not clearing app data if you want to keep your saved items.",
      },
      {
        q: "Is my saved data backed up to the cloud?",
        a: "Currently, saved hadiths, bookmarks, and tasbih history are stored locally on your device only. Cloud backup for this data is planned for a future update.",
      },
      {
        q: "How do I save a hadith or surah?",
        a: "Open any hadith or surah and tap the bookmark icon. It will be saved to your profile under favourites.",
      },
    ],
  },
  {
    category: "Features",
    items: [
      {
        q: "How does the Qibla direction work?",
        a: "The Qibla feature uses your device's compass and location to point toward the Kaaba. Make sure location permission is granted for accurate results.",
      },
      {
        q: "Which Hadith books are available?",
        a: "StepTuDeen includes Sahih Bukhari, Sahih Muslim, Tirmizi, Abu Dawood, Ibn Majah, Nasai, Riyad Saliheen, Muwatta Malik, and Al-Adab Al-Mufrad.",
      },
      {
        q: "What does the Imam Panel do?",
        a: "The Imam Panel allows registered Imams to update real-time prayer times, Eid timings, and masjid location information for their community.",
      },
      {
        q: "Is the Quran recitation available offline?",
        a: "Currently, recitation requires an internet connection. Offline support is planned for a future update.",
      },
    ],
  },
  {
    category: "Technical Issues",
    items: [
      {
        q: "The app is running slowly. What can I do?",
        a: "Try closing and reopening the app. If the issue persists, clear the app cache from your phone settings — note that this will remove locally saved data.",
      },
      {
        q: "Prayer times are not showing correctly.",
        a: "Make sure location permission is enabled for StepTuDeen. If the issue continues, contact us at steptodeen@gmail.com with your city name.",
      },
      {
        q: "I found a mistake in a hadith or Quran.",
        a: "Please report it to us at steptodeen@gmail.com with the hadith or Quran reference. We take accuracy very seriously and will review it promptly.",
      },
    ],
  },
  {
    category: "General",
    items: [
      {
        q: "Is StepTuDeen free to use?",
        a: "Yes, StepTuDeen is completely free. There are no hidden charges or subscriptions.",
      },
      {
        q: "What languages are supported?",
        a: "Currently the app supports Urdu Hindi English 11+ languages. Support for 50+ languages is coming in a future update.",
      },
      {
        q: "How can I contact support?",
        a: "You can reach us at steptodeen@gmail.com or through the Contact Us section in the app menu.",
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface FAQProps {
  onBack?: () => void;
}

export default function FAQPage({ onBack }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  function toggle(key: string) {
    setOpenIndex(prev => (prev === key ? null : key));
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
          FAQ
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Frequently Asked Questions
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {FAQS.map((section) => (
          <div key={section.category} style={{ marginBottom: 20 }}>

            {/* Category Title */}
            <h3 style={{
              fontSize: 12, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "#94a3b8",
              marginBottom: 10, paddingLeft: 4,
            }}>
              {section.category}
            </h3>

            {/* Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {section.items.map((item, i) => {
                const key = `${section.category}-${i}`;
                const isOpen = openIndex === key;
                return (
                  <div
                    key={key}
                    style={{
                      background: "#ffffff", borderRadius: 12,
                      border: "1px solid #f1f5f9",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => toggle(key)}
                      style={{
                        width: "100%", padding: "13px 14px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "none", border: "none", cursor: "pointer",
                        textAlign: "left", gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>
                        {item.q}
                      </span>
                      <span style={{ flexShrink: 0, color: "#94a3b8" }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{
                        padding: "0 14px 13px",
                        fontSize: 13, color: "#475569", lineHeight: 1.7,
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: 10,
                      }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact Footer */}
        <div style={{
          background: "#ffffff", borderRadius: 12, padding: "16px",
          border: "1px solid #f1f5f9", textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
            Did not find your answer?
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>
            Contact us directly and we will help you.
          </p>
          <a href="mailto:steptodeen@gmail.com" style={{
            display: "inline-block", padding: "9px 20px",
            background: "linear-gradient(145deg, #3b82f6, #1d5fd6)",
            color: "#ffffff", borderRadius: 10, fontSize: 13,
            fontWeight: 600, textDecoration: "none",
          }}>
            steptodeen@gmail.com
          </a>
        </div>

      </div>
    </div>
  );
}
