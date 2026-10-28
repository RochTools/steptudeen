import { FileText } from "lucide-react";

interface TermsProps {
  onBack?: () => void;
}

export default function TermsOfServicePage({ onBack }: TermsProps) {
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
          Terms of Service
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Last updated: August 2026
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* Intro */}
        <SectionCard title="1. Acceptance of Terms">
          <p style={para}>
            By downloading or using <strong>StepTuDeen</strong>, you agree to these Terms of Service.
            If you do not agree, please do not use the app.
          </p>
          <p style={para}>
            These terms apply to all users including regular users and Imam account holders.
          </p>
        </SectionCard>

        {/* Use of App */}
        <SectionCard title="2. Use of the App">
          <p style={para}>StepTuDeen is an Islamic app provided for the purpose of:</p>
          <ul style={list}>
            <li style={listItem}>Accessing Quran and Hadith with Urdu translation</li>
            <li style={listItem}>Performing daily azkar and tasbih</li>
            <li style={listItem}>Finding Qibla direction</li>
            <li style={listItem}>Viewing masjid prayer times and locations</li>
          </ul>
          <p style={para}>
            You agree to use the app only for its intended Islamic purpose and not for any
            unlawful or harmful activity.
          </p>
        </SectionCard>

        {/* User Accounts */}
        <SectionCard title="3. User Accounts">
          <p style={para}>
            When creating an account, you must provide accurate information including your
            name and a valid Gmail address. You are responsible for keeping your password secure.
          </p>
          <p style={para}>
            StepTuDeen reserves the right to suspend or delete any account that violates
            these terms.
          </p>
        </SectionCard>

        {/* Imam Panel */}
        <SectionCard title="4. Imam Panel — Terms & Conditions">
          <p style={para}>
            The Imam Panel is a special feature that allows users to manage masjid prayer times,
            Eid timings, and location information for their community.
          </p>
          <p style={para}><strong>Who can create an Imam account:</strong></p>
          <ul style={list}>
            <li style={listItem}>Any user can register as an Imam</li>
            <li style={listItem}>The Imam must be able to provide accurate and up-to-date prayer times and masjid location</li>
          </ul>
          <p style={para}><strong>Account removal policy:</strong></p>
          <ul style={list}>
            <li style={listItem}>If it is found that an Imam account was created without a genuine reason or masjid affiliation, the account may be deleted without prior notice</li>
            <li style={listItem}>Providing false masjid information is a violation of these terms</li>
            <li style={listItem}>StepTuDeen reserves the right to remove any Imam account at its discretion</li>
          </ul>
        </SectionCard>

        {/* Content Accuracy */}
        <SectionCard title="5. Content Accuracy">
          <p style={para}>
            StepTuDeen strives to provide authentic and accurate Islamic content. All hadiths
            are graded as Sahih, Hasan, or Da'if. However, we are not responsible for any
            errors or omissions.
          </p>
          <p style={para}>
            If you notice any mistake in the content, please report it to us at
            steptodeen@gmail.com.
          </p>
        </SectionCard>

        {/* Local Data */}
        <SectionCard title="6. Local Data & Storage">
          <p style={para}>
            Certain data such as saved hadiths, bookmarks, and tasbih history is stored
            locally on your device. StepTuDeen is not responsible for loss of this data
            if the app cache or data is cleared from device settings.
          </p>
        </SectionCard>

        {/* Intellectual Property */}
        <SectionCard title="7. Intellectual Property">
          <p style={para}>
            All content, design, and code within StepTuDeen is the property of StepTuDeen.
            You may not copy, reproduce, or distribute any part of the app without permission.
          </p>
        </SectionCard>

        {/* Disclaimer */}
        <SectionCard title="8. Disclaimer">
          <p style={para}>
            StepTuDeen is currently in Beta. The app is provided "as is" without any warranty.
            We are continuously working to improve the app and some features may change or
            be unavailable at times.
          </p>
        </SectionCard>

        {/* Changes */}
        <SectionCard title="9. Changes to Terms">
          <p style={para}>
            These Terms of Service may be updated in the future. Continued use of the app
            after any changes means you accept the updated terms. We will notify users of
            significant changes through the app.
          </p>
        </SectionCard>

        {/* Contact */}
        <SectionCard title="10. Contact">
          <p style={para}>
            For any questions regarding these terms, please contact us at:
          </p>
          <a href="mailto:steptodeen@gmail.com" style={{
            display: "inline-block", marginTop: 4,
            color: "#2563eb", fontWeight: 700, fontSize: 14,
            textDecoration: "none",
          }}>
            steptodeen@gmail.com
          </a>
        </SectionCard>

        {/* Footer */}
        <div style={{
          background: "#ffffff", borderRadius: 12, padding: "14px 16px",
          border: "1px solid #f1f5f9", textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            © 2026 StepTuDeen, Pakistan
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Helper Component ─────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: 16, padding: "16px 18px",
      marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      border: "1px solid #f1f5f9",
    }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const para: React.CSSProperties = {
  margin: "0 0 8px", fontSize: 13, color: "#475569", lineHeight: 1.7,
};

const list: React.CSSProperties = {
  margin: "6px 0 8px", paddingLeft: 20,
};

const listItem: React.CSSProperties = {
  fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 4,
};
