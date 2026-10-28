import { Shield } from "lucide-react";

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export default function PrivacyPolicyPage({ onBack }: PrivacyPolicyProps) {
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
          Privacy Policy
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Last updated: August 2026
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>

        {/* Intro */}
        <Section>
          <p style={para}>
            Welcome to <strong>StepTuDeen</strong>. We are committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, and safeguard your information
            when you use our app.
          </p>
          <p style={para}>
            StepTuDeen is operated from <strong>Pakistan</strong> and is designed to help
            Muslims access authentic Islamic knowledge easily.
          </p>
        </Section>

        {/* Data We Collect */}
        <SectionCard title="1. Information We Collect">
          <p style={para}>When you create an account, we collect and store the following information in our secure Firebase database:</p>
          <ul style={list}>
            <li style={listItem}><strong>Full Name</strong> — to personalize your experience</li>
            <li style={listItem}><strong>Gmail Address</strong> — used for login and account identification</li>
            <li style={listItem}><strong>Password</strong> — encrypted and stored securely via Firebase Authentication</li>
          </ul>
          <p style={para}>
            The same applies to <strong>Imam accounts</strong> — name, Gmail, and password are stored
            to allow Imams to manage their masjid profile and prayer times.
          </p>
        </SectionCard>

        {/* How We Use */}
        <SectionCard title="2. How We Use Your Data">
          <ul style={list}>
            <li style={listItem}>To create and manage your account</li>
            <li style={listItem}>To allow you to log in securely</li>
            <li style={listItem}>To save your favourites, bookmarks, and tasbih count</li>
            <li style={listItem}>To allow Imams to update prayer times and masjid information</li>
          </ul>
        </SectionCard>

        {/* What We Don't Collect */}
        <SectionCard title="3. What We Do NOT Collect">
          <p style={para}>We do <strong>not</strong> collect or store:</p>
          <ul style={list}>
            <li style={listItem}>Your location data</li>
            <li style={listItem}>Phone number</li>
            <li style={listItem}>Payment or financial information</li>
            <li style={listItem}>Device contacts or media</li>
            <li style={listItem}>Any data beyond what is mentioned above</li>
          </ul>
        </SectionCard>

        {/* Data Security */}
        <SectionCard title="4. Data Security">
          <p style={para}>
            Your data is stored securely using <strong>Google Firebase</strong>, which provides
            industry-standard encryption and security. Passwords are never stored in plain text.
          </p>
          <p style={para}>
            We do not sell, rent, or share your personal data with any third parties.
          </p>
        </SectionCard>

        {/* Third Party */}
        <SectionCard title="5. Third-Party Services">
          <p style={para}>
            StepTuDeen uses <strong>Firebase</strong> (by Google) for authentication and database
            services. Firebase has its own privacy policy which can be found at{" "}
            <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer"
              style={{ color: "#2563eb", fontWeight: 600 }}>
              firebase.google.com/support/privacy
            </a>.
          </p>
        </SectionCard>

        {/* Children */}
        <SectionCard title="6. Children's Privacy">
          <p style={para}>
            StepTuDeen is suitable for all ages. We do not knowingly collect personal data
            from children under 13 without parental consent.
          </p>
        </SectionCard>

        {/* Changes */}
        <SectionCard title="7. Changes to This Policy">
          <p style={para}>
            This Privacy Policy may be updated in the future as new features are added to StepTuDeen.
            We will notify users of any significant changes through the app. Continued use of the app
            after changes means you accept the updated policy.
          </p>
        </SectionCard>

        {/* Contact */}
        <SectionCard title="8. Contact Us">
          <p style={para}>
            If you have any questions or concerns about this Privacy Policy, please contact us at:
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
          border: "1px solid #f1f5f9", textAlign: "center", marginTop: 8,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
            © 2026 StepTuDeen — Pakistan
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
            May Allah bless this effort. Ameen
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: 16, padding: "16px 18px",
      marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      border: "1px solid #f1f5f9",
    }}>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: 16, padding: "16px 18px",
      marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      border: "1px solid #f1f5f9",
    }}>
      <h2 style={{
        margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#0f172a",
      }}>
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
