import React from "react";

/* مینیو کے معلوماتی صفحات (About / Privacy / Terms / FAQ / Help / Contact) کا مشترکہ بلاگ انداز:
   بڑا serif عنوان، پتلی لکیر، متن، نیلی پٹی والا باکس، "What We Offer" جیسے سیکشن اور ہلکے خاکستری کارڈ۔ */

const SERIF = "'Noto Serif', Georgia, 'Times New Roman', serif";
const INK = "#1b1b1b";
const BODY = "#3a3a3a";

export function InfoPage(props: { title: string; meta?: string; onBack?: () => void; children: React.ReactNode }) {
  const { title, meta, onBack, children } = props;
  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: "#f1f2f4", fontFamily: SERIF }}>
      {/* اوپر کی پٹی: بیک + برانڈ */}
      <div style={{
        background: "#ffffff", borderBottom: "1px solid #e5e7eb",
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: "linear-gradient(135deg,#3b8bff 0%,#1a63d8 100%)", border: "none", color: "#fff",
            borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}>← Back</button>
        )}
        <span style={{ fontSize: 22, fontWeight: 700, color: "#0f4d3a", letterSpacing: "-0.3px" }}>steptudeen</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 14px 48px" }}>
        <article style={{
          background: "#ffffff", borderRadius: 22, padding: "26px 22px 30px",
          boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
        }}>
          <h1 style={{ margin: 0, fontSize: 31, lineHeight: 1.2, fontWeight: 700, color: INK, letterSpacing: "-0.4px" }}>{title}</h1>
          <div style={{ height: 1, background: "#e3e3e3", margin: "14px 0 6px" }} />
          {meta && <p style={{ margin: "0 0 18px", fontSize: 15, color: "#767676" }}>{meta}</p>}
          {children}
        </article>
        <p style={{ textAlign: "center", fontSize: 12, color: "#8a8f98", margin: "18px 0 0", fontFamily: "system-ui, sans-serif" }}>
          © 2026 StepTuDeen — Pakistan
        </p>
      </div>
    </div>
  );
}

export const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: "0 0 18px", fontSize: 17, lineHeight: 1.95, color: BODY }}>{children}</p>
);

/** نیلی بائیں پٹی والا نمایاں باکس ("Our Vision: …") */
export const Callout: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{
    background: "#eef2ff", borderLeft: "5px solid #1d6df2", borderRadius: 10,
    padding: "18px 20px", margin: "6px 0 26px", fontSize: 17, lineHeight: 1.95, color: BODY,
  }}>
    {label && <strong style={{ color: INK }}>{label} </strong>}
    {children}
  </div>
);

export const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <h2 style={{ margin: "30px 0 0", paddingBottom: 12, fontSize: 25, lineHeight: 1.25, fontWeight: 700, color: INK }}>{children}</h2>
    <div style={{ height: 1, background: "#e3e3e3", margin: "0 0 18px" }} />
  </>
);

/** ہلکے خاکستری رنگ کا کارڈ (عنوان + تفصیل) */
export const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: "#f6f7f9", border: "1px solid #eceef1", borderRadius: 14, padding: "20px 22px", margin: "0 0 14px" }}>
    <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: INK }}>{title}</h3>
    <div style={{ fontSize: 16, lineHeight: 1.85, color: BODY }}>{children}</div>
  </div>
);

export const UL: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul style={{ margin: "0 0 18px", paddingLeft: 22, fontSize: 17, lineHeight: 1.9, color: BODY }}>
    {items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{it}</li>)}
  </ul>
);

export const MailLink: React.FC<{ email?: string }> = ({ email = "steptodeen@gmail.com" }) => (
  <a href={`mailto:${email}`} style={{ color: "#1d6df2", fontWeight: 700, textDecoration: "none", wordBreak: "break-all" }}>{email}</a>
);
