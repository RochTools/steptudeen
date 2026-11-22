import { useState } from "react";
import { InfoPage, P, H2, MailLink } from "./InfoLayout";

interface FAQProps { onBack?: () => void }

const FAQ = [
  {
    category: "Getting Started",
    items: [
      { q: "Do I need an account to use StepTuDeen?", a: "No. The Quran, Hadith, Duas, 99 Names, Tasbih, Qibla, prayer times and Masjid Finder work without an account. You only sign in with Google for your profile or to use the Imam Panel." },
      { q: "Is StepTuDeen free?", a: "Yes. It is completely free, with no subscriptions and no advertisements." },
      { q: "Which languages are supported?", a: "The app interface is in English. The Quran has translations in 11 languages, Hadith in up to nine, Duas in Arabic, English, Urdu and Hindi, and the 99 Names in Urdu, English and Hindi." },
    ],
  },
  {
    category: "Quran, Hadith & Duas",
    items: [
      { q: "Which Hadith books are included?", a: "Sahih al-Bukhari, Sahih Muslim, Sunan Abu Dawud, Jami at-Tirmidhi, Sunan an-Nasai, Sunan Ibn Majah and Muwatta Imam Malik." },
      { q: "Do I need internet to read the Quran?", a: "The Quran text, translations and font are stored inside the app, so you can read without internet. Audio recitation and tafsir need an internet connection." },
      { q: "Some dua translations are marked 'AI translation'. Can I trust them?", a: "The Arabic text is the original. Some Urdu and Hindi translations are machine-generated and labelled as such. Please verify them with a trusted published translation." },
      { q: "I found a mistake. How do I report it?", a: "Email us the reference (surah and ayah, or the hadith book and number) and we will review it carefully." },
    ],
  },
  {
    category: "Prayer Times & Notifications",
    items: [
      { q: "How are prayer times decided?", a: "Prayer times are calculated for your location, and a masjid can set its own jamaat times through the Imam Panel. Jamaat times can differ from calculated times, so always follow your local masjid." },
      { q: "How do I change the notification sound?", a: "Open Menu → Settings and choose between azan, spoken voice or a simple tone. The sound can be changed on the Android app." },
      { q: "Notifications are late or not arriving.", a: "Some phones stop background apps to save battery. Allow notifications for StepTuDeen, and in your phone's battery settings set the app to 'Unrestricted' or 'Not optimised'." },
    ],
  },
  {
    category: "Location, Qibla & Masjids",
    items: [
      { q: "Location permission is blocked. What now?", a: "Open your phone's Settings → Apps → StepTuDeen → Permissions → Location and choose 'Allow while using the app'. Then return to the app and tap to refresh your location." },
      { q: "The Qibla compass shows the wrong direction.", a: "Move your phone in a figure-8 in the air to calibrate it and keep it away from magnets, metal and phone cases with magnetic clasps. If it is still off, stand facing the Qibla and use the 'I'm facing Qibla — Calibrate' button on the Qibla screen." },
      { q: "Why are some mosques missing or unnamed?", a: "Mosque data comes from OpenStreetMap, which volunteers keep updated. Some mosques have no name or are not yet added. You can add them on openstreetmap.org to help everyone." },
      { q: "What is the Imam Panel?", a: "It lets an Imam (or authorised person) register a masjid and publish accurate jamaat and Eid timings and the masjid's location for the community." },
    ],
  },
  {
    category: "Updates & Support",
    items: [
      { q: "How do I update the Android app?", a: "When a new version is released, the app shows a notice with an Update button. You can also open Menu and tap 'Update available'. After downloading, open the file to install it." },
      { q: "Is my data safe?", a: "We collect only what the app needs, and we do not sell your data. See the Privacy Policy for details." },
      { q: "How can I contact support?", a: "Use the Contact Us page in the menu, or email us." },
    ],
  },
];

export default function FAQPage({ onBack }: FAQProps) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <InfoPage title="Frequently Asked Questions" meta="Quick answers about StepTuDeen" onBack={onBack}>
      {FAQ.map(group => (
        <div key={group.category}>
          <H2>{group.category}</H2>
          {group.items.map(item => {
            const id = group.category + item.q;
            const isOpen = open === id;
            return (
              <div key={id} style={{ background: "#f6f7f9", border: "1px solid #eceef1", borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : id)}
                  style={{
                    width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer",
                    padding: "16px 18px", display: "flex", gap: 10, alignItems: "center",
                    fontFamily: "inherit", fontSize: 17, fontWeight: 700, color: "#1b1b1b", lineHeight: 1.4,
                  }}
                >
                  <span style={{ flex: 1 }}>{item.q}</span>
                  <span style={{ color: "#1d6df2", fontSize: 22, lineHeight: 1 }}>{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <p style={{ margin: 0, padding: "0 18px 18px", fontSize: 16, lineHeight: 1.85, color: "#3a3a3a" }}>{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ height: 8 }} />
      <P>Still need help? Write to us at <MailLink />.</P>
    </InfoPage>
  );
}
