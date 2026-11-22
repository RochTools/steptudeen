import { InfoPage, P, Callout, H2, UL, MailLink } from "./InfoLayout";

interface TermsProps { onBack?: () => void }

export default function TermsOfServicePage({ onBack }: TermsProps) {
  return (
    <InfoPage title="Terms of Service" meta="Last updated: November 2026" onBack={onBack}>
      <P>
        By installing or using <strong>StepTuDeen</strong>, you agree to these terms. If you do not agree, please do not
        use the app.
      </P>

      <Callout label="Please note:">
        StepTuDeen is a helpful tool, not a replacement for scholars. For religious rulings, always consult a
        qualified scholar, and confirm prayer times with your local masjid.
      </Callout>

      <H2>1. Use of the App</H2>
      <UL items={[
        "StepTuDeen is free for personal, non-commercial use.",
        "Use it respectfully and lawfully; do not misuse, copy, scrape or disrupt the app or its services.",
        "Do not attempt to break into accounts, other users' data or our servers.",
      ]} />

      <H2>2. Accounts</H2>
      <P>
        Signing in is optional and uses your Google account. You are responsible for keeping your Google account secure
        and for what happens under it. We may suspend an account that is used to abuse the app.
      </P>

      <H2>3. Imam Panel</H2>
      <P>The Imam Panel lets a masjid's Imam or authorised person publish prayer, jamaat and Eid timings and the masjid's location.</P>
      <UL items={[
        "You must be genuinely connected with the masjid you register and keep its timings accurate and current.",
        "Giving false masjid information, registering masjids you are not connected with, or posting inappropriate content is not allowed.",
        "Information you publish is visible to the public.",
        "StepTuDeen may edit or remove any masjid listing or Imam account, with or without notice, if these rules are broken.",
      ]} />

      <H2>4. Religious Content</H2>
      <P>
        Quran text and translations, Hadith collections, Duas and the 99 Names come from published and open sources.
        We work hard to present them correctly, but errors can occur. Some translations, such as certain Urdu and Hindi
        dua translations, are machine-generated and are labelled as such; please verify them with a trusted published
        translation. Report mistakes to us and we will review them.
      </P>

      <H2>5. Prayer Times, Qibla and Maps</H2>
      <UL items={[
        "Prayer times are calculated or provided for your location and may differ from your local masjid. Jamaat times are set by each masjid.",
        "The Qibla compass depends on your phone's sensors and can be wrong near magnets, metal or if the sensor is uncalibrated. Move your phone in a figure-8 to calibrate, and confirm with a known direction when you can.",
        "Mosque and map data come from OpenStreetMap contributors and may be incomplete or out of date.",
      ]} />

      <H2>6. Notifications and Permissions</H2>
      <P>
        Notifications, location and sensors are used only for the features you turn on. You can change permissions
        in your phone's settings at any time. Notification delivery depends on your device, network and battery settings,
        so please do not rely on it as your only reminder.
      </P>

      <H2>7. Updates and Downloads</H2>
      <P>
        The Android app may be distributed as an APK outside an app store. Download it only from the official StepTuDeen
        website or release page. The app may tell you when a new version is available. Installing apps from outside a store
        is done at your own discretion.
      </P>

      <H2>8. Local Data</H2>
      <P>
        Saved items such as bookmarks and tasbih counts are stored on your device and can be lost if you clear app data or
        uninstall the app.
      </P>

      <H2>9. Intellectual Property and Licences</H2>
      <P>
        The StepTuDeen name, logo and app design belong to StepTuDeen. Religious texts are public heritage and remain the
        property of their authors and publishers. Third-party data keeps its own licence, including OpenStreetMap data
        (© OpenStreetMap contributors, ODbL) and the Hisn al-Muslim dataset (CC BY 4.0).
      </P>

      <H2>10. Disclaimer</H2>
      <P>
        The app is provided "as is", without warranties of any kind. To the extent allowed by law, StepTuDeen is not
        liable for any loss resulting from using the app or relying on its information, including missed prayers caused by
        inaccurate times or notification delays.
      </P>

      <H2>11. Changes to These Terms</H2>
      <P>We may change these terms as the app develops. The date above shows the latest version, and continued use means you accept the changes.</P>

      <H2>12. Contact</H2>
      <P>Questions about these terms? Email us at <MailLink />.</P>
    </InfoPage>
  );
}
