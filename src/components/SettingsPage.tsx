import { useState, useEffect } from "react";
import { Settings, MapPin } from "lucide-react";

interface SettingsProps {
  onBack?: () => void;
}

export default function SettingsPage({ onBack }: SettingsProps) {
  const [locationStatus, setLocationStatus] = useState<"granted" | "denied" | "prompt" | "unsupported">("prompt");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }
    navigator.permissions?.query({ name: "geolocation" }).then((result) => {
      setLocationStatus(result.state as any);
      result.onchange = () => setLocationStatus(result.state as any);
    });
  }, []);

  async function handleRequestLocation() {
    if (!navigator.geolocation) return;
    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus("granted");
        setRequesting(false);
      },
      () => {
        setLocationStatus("denied");
        setRequesting(false);
      }
    );
  }

  const statusColor =
    locationStatus === "granted"
      ? "#16a34a"
      : locationStatus === "denied"
      ? "#dc2626"
      : "#f59e0b";

  const statusText =
    locationStatus === "granted"
      ? "Allowed"
      : locationStatus === "denied"
      ? "Denied"
      : locationStatus === "unsupported"
      ? "Not Supported"
      : "Not Set";

  const statusBg =
    locationStatus === "granted"
      ? "#f0fdf4"
      : locationStatus === "denied"
      ? "#fef2f2"
      : "#fffbeb";

  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      
      {/* Header */}
      <div
        style={{
          background: "#ffffff",
          padding: "14px 16px", borderBottom: "1px solid #e2e8f0",
          textAlign: "center",
          color: "#0b1f4d",
          position: "relative",
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              position: "absolute",
              top: "50%", transform: "translateY(-50%)", left: 12,
              background: "#2563eb",
              border: "none",
              color: "#fff",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )} 
        <h1 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px" }}>
          Settings
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          Manage your app preferences
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>
        
        {/* Section Title */}
        <h3
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#94a3b8",
            marginBottom: 10,
            paddingLeft: 4,
          }}
        >
          Permissions
        </h3>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: "16px",
            border: "1px solid #f1f5f9",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          {/* Location Row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                flexShrink: 0,
                background: "#eff6ff",
                color: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPin size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                Location Permission
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Required to find nearby masjids and provide accurate Qibla direction.
              </p>

              {/* Status Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: statusBg,
                  borderRadius: 20,
                  padding: "4px 12px",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: statusColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
                  {statusText}
                </span>
              </div>

              {/* ==================== اگر لوکیشن بلاک ہے ==================== */}
              {locationStatus === "denied" && (
                <div>
                  {/* نوٹ: پاپ اپ میں بلاک کرنے پر مینوئل طریقہ */}
                  <div
                    style={{
                      background: "#fffbeb",
                      borderRadius: 10,
                      padding: "12px 14px",
                      border: "1px solid #fde68a",
                      borderLeft: "3px solid #f59e0b",
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                      <strong>⚠️ Important Note:</strong> If you tapped <strong>"Block"</strong> on the
                      location popup, the browser will not show it again. You must manually allow
                      location from your browser settings.
                    </p>
                  </div>

                  {/* بلاک کی ہوئی لوکیشن کو مینوئلی Allow کرنے کا طریقہ */}
                  <div
                    style={{
                      background: "#fef2f2",
                      borderRadius: 10,
                      padding: "12px 14px",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                      Location Blocked
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#7f1d1d", lineHeight: 1.7 }}>
                      You have blocked location permission. Follow these steps to allow it:
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.9 }}>
                      1. Open Chrome menu (⋮ top right)<br />
                      2. Settings → Site Settings → Location<br />
                      3. Find this site and change to <strong>Allow</strong><br />
                      4. Come back and tap Back — done!
                    </p>
                  </div>
                </div>
              )}

              {/* ==================== اگر لوکیشن Allow ہے ==================== */}
              {locationStatus === "granted" && (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#16a34a", fontWeight: 500 }}>
                  ✓ Location is active. Masjid finder and Qibla are working correctly.
                </p>
              )}

              {/* ==================== اگر لوکیشن Promt/Not Set ہے (بٹن دکھائیں) ==================== */}
              {locationStatus !== "denied" && locationStatus !== "granted" && locationStatus !== "unsupported" && (
                <div>
                  {/* بٹن سے پہلے نوٹ */}
                  <div
                    style={{
                      background: "#fffbeb",
                      borderRadius: 10,
                      padding: "10px 14px",
                      border: "1px solid #fde68a",
                      borderLeft: "3px solid #f59e0b",
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                      <strong>⚠️ Important:</strong> When the popup appears, do <strong>not</strong>{" "}
                      tap "Block". If you block it, you will have to manually enable location from
                      browser settings.
                    </p>
                  </div>

                  {/* Allow Location Button */}
                  <button
                    onClick={handleRequestLocation}
                    disabled={requesting}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: requesting
                        ? "#e2e8f0"
                        : "linear-gradient(145deg, #3b82f6, #1d5fd6)",
                      color: requesting ? "#94a3b8" : "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: requesting ? "not-allowed" : "pointer",
                    }}
                  >
                    {requesting ? "Requesting..." : "Allow Location"}
                  </button>
                </div>
              )}

              {/* ==================== اگر لوکیشن سپورٹ نہیں ==================== */}
              {locationStatus === "unsupported" && (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626" }}>
                  ⚠️ Geolocation is not supported on this device or browser.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* نیچے پرائیویسی نوٹ */}
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            borderLeft: "3px solid #3b82f6",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            <strong>🔒 Privacy Note:</strong> StepTuDeen only uses your location to find nearby
            masjids and calculate Qibla direction. Your location is never stored or shared.
          </p>
        </div>
      </div>
    </div>
  );
}
