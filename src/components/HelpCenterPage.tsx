import { HeadphonesIcon } from "lucide-react";

interface HelpCenterProps {
  onBack?: () => void;
}

export default function HelpCenterPage({ onBack }: HelpCenterProps) {
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
          Help Center
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          How to use StepTuDeen
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* Important Notice */}
        <div style={{
          background: "#fef2f2", borderRadius: 16, padding: "16px 18px",
          marginBottom: 12, border: "2px solid #fecaca",
        }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#dc2626" }}>
            Important: Location Permission Issue
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            StepTuDeen requires location permission to show nearby masjids and calculate Qibla direction. If you tapped "Allow Location" and nothing happened, or if masjid distances appear incorrect, your browser may have blocked the location permission.
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            How to fix this on Android (Chrome):
          </p>
          <Step number="1" text="Open Chrome browser and tap the three-dot menu (top right)." />
          <Step number="2" text="Go to Settings → Site Settings → Location." />
          <Step number="3" text="Find StepTuDeen (steptudeen.hubproapk.workers.dev) in the blocked list." />
          <Step number="4" text='Tap on it and change the permission to Allow.' />
          <Step number="5" text="Come back to the app and tap Allow Location again — it will now work." />
          <Note text="Once blocked, the browser will not show the permission popup again until you manually allow it from browser settings. This is a browser security limitation and cannot be bypassed by the app." />
        </div>

        {/* Section 1 */}
        <Section title="1. Getting Started">
          <Step number="1" text="Open the app and tap Sign Up on the login screen." />
          <Step number="2" text="Enter your full name, Gmail address, and a password." />
          <Step number="3" text="Tap Create Account. You are now logged in." />
          <Step number="4" text="If you already have an account, tap Login and enter your Gmail and password." />
          <Note text="Some features like Quran, Hadith, and Qibla are available without an account." />
        </Section>

        {/* Section 2 */}
        <Section title="2. Quran Majeed">
          <Step number="1" text="Tap the Quran icon from the home screen." />
          <Step number="2" text="Browse by Surah or search by name." />
          <Step number="3" text="Tap any Surah to open it with Urdu translation." />
          <Step number="4" text="Tap the bookmark icon to save a Surah to your favourites." />
          <Step number="5" text="Tap the play button to listen to the recitation." />
          <Note text="Recitation requires an internet connection." />
        </Section>

        {/* Section 3 */}
        <Section title="3. Hadith Books">
          <Step number="1" text="Tap the Hadith section from the home screen." />
          <Step number="2" text="Select a book — Sahih Bukhari, Muslim, Tirmizi, Abu Dawood, Ibn Majah, Nasai, Riyad Saliheen, Muwatta Malik, or Al-Adab Al-Mufrad." />
          <Step number="3" text="Browse chapters and tap any hadith to read it." />
          <Step number="4" text="Each hadith shows its grade — Sahih, Hasan, or Da'if." />
          <Step number="5" text="Tap the bookmark icon to save a hadith." />
        </Section>

        {/* Section 4 */}
        <Section title="4. Masnoon Duas">
          <Step number="1" text="Open the Duas section from the home screen." />
          <Step number="2" text="Duas are organized by category such as morning, evening, eating, sleeping, and more." />
          <Step number="3" text="Tap any dua to read the Arabic text with Urdu translation." />
        </Section>

        {/* Section 5 */}
        <Section title="5. Digital Tasbih">
          <Step number="1" text="Open the Tasbih section." />
          <Step number="2" text="Tap the counter button to count." />
          <Step number="3" text="Your tasbih count is saved locally on your device." />
          <Note text="If you clear the app data from phone settings, your tasbih history will be deleted." />
        </Section>

        {/* Section 6 */}
        <Section title="6. Qibla Direction">
          <Step number="1" text="Open the Qibla section." />
          <Step number="2" text="Allow location permission when asked." />
          <Step number="3" text="The compass will point toward the Kaaba based on your current location." />
          <Note text="For accurate results, make sure your phone compass is calibrated." />
        </Section>

        {/* Section 7 */}
        <Section title="7. Prayer Times & Masjid Finder">
          <Step number="1" text="Open the Masjid section from the home screen." />
          <Step number="2" text="Allow location permission to find nearby masjids." />
          <Step number="3" text="Tap any masjid to view its prayer times and location." />
          <Step number="4" text="Prayer times are updated by the Imam of each masjid." />
        </Section>

        {/* Section 8 */}
        <Section title="8. Imam Panel">
          <Step number="1" text="On the login screen, select Imam Login." />
          <Step number="2" text="Register with your name, Gmail, and password." />
          <Step number="3" text="After login, you can update your masjid name, location, and prayer times." />
          <Step number="4" text="You can also update Eid timings when required." />
          <Note text="Imam accounts are monitored. Accounts created without a genuine masjid may be removed." />
        </Section>

        {/* Section 9 */}
        <Section title="9. User Profile">
          <Step number="1" text="Tap the profile icon to open your dashboard." />
          <Step number="2" text="View your saved hadiths, bookmarked surahs, and tasbih history." />
          <Step number="3" text="To logout, tap the logout button in your profile." />
        </Section>

        {/* Contact Support */}
        <div style={{
          background: "#ffffff", borderRadius: 12, padding: "16px",
          border: "1px solid #f1f5f9", textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
            Still need help?
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
            Contact us directly and we will get back to you.
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

// ─── Helper Components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: 16, padding: "16px 18px",
      marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      border: "1px solid #f1f5f9",
    }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{
        minWidth: 22, height: 22, borderRadius: 6,
        background: "#0b1f4d", color: "#ffffff",
        fontSize: 11, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 1,
      }}>
        {number}
      </span>
      <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
        {text}
      </p>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div style={{
      background: "#f8fafc", borderRadius: 8, padding: "8px 12px",
      borderLeft: "3px solid #2563eb", marginTop: 4,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
        <strong>Note:</strong> {text}
      </p>
    </div>
  );
}
