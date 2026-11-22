import { InfoPage, P, Callout, H2, InfoCard, UL, MailLink } from "./InfoLayout";

interface PrivacyPolicyProps { onBack?: () => void }

export default function PrivacyPolicyPage({ onBack }: PrivacyPolicyProps) {
  return (
    <InfoPage title="Privacy Policy" meta="Last updated: November 2026" onBack={onBack}>
      <P>
        <strong>StepTuDeen</strong> is operated from Pakistan. This policy explains, in plain words, what the app
        uses, why, and what stays on your phone. You can use most of the app (Quran, Hadith, Duas, Tasbih, 99 Names,
        Qibla and prayer times) without creating an account.
      </P>

      <Callout label="In short:">
        We do not sell your data, we show no ads, and we do not track you across other apps or websites.
        Your location is used to give you prayer times, Qibla and nearby mosques; we do not store it in your account.
      </Callout>

      <H2>1. Information We Collect</H2>
      <InfoCard title="Account (optional)">
        If you sign in with Google (for your profile or as an Imam), we receive your <strong>name and email
        address</strong> from your Google account and store them in our Firebase database. We never see or store your
        Google password.
      </InfoCard>
      <InfoCard title="Imam and masjid information">
        Imams enter their masjid's name, address, map location and prayer, jamaat and Eid timings. This information
        is meant to be public so that the community can see it.
      </InfoCard>
      <InfoCard title="Your saved items">
        Bookmarks, favourites, tasbih counts and your settings (such as language and notification sound) are kept on your
        device. If you are signed in, your favourites and bookmarks may also be saved to your profile.
      </InfoCard>
      <InfoCard title="Ratings and feedback">
        If you submit a rating or review, we store your review and the name you provide. Emails you send us are
        handled by your email app and are only used to reply to you.
      </InfoCard>

      <H2>2. Location</H2>
      <P>
        With your permission, the app uses your device location to calculate prayer times, show the Qibla direction and
        find nearby mosques. Your most recent coordinates are kept <strong>on your device only</strong> so the app works
        faster next time. They are not saved to your account or to our database. You can turn location off at any time
        in your phone's settings, but location-based features will then not work.
      </P>
      <P>
        To work, some features send coordinates to third-party services (see section 4): prayer-time lookups, map
        tiles, and mosque data for your area.
      </P>

      <H2>3. Notifications and Sensors</H2>
      <UL items={[
        <>Prayer notifications use <strong>Firebase Cloud Messaging</strong>. A notification token and the masjid and
          sound you choose are used only to deliver notifications to you.</>,
        <>The Qibla compass reads your phone's motion and magnetic sensors <strong>on the device</strong>. This sensor
          data is never uploaded.</>,
      ]} />

      <H2>4. Third-Party Services</H2>
      <UL items={[
        <><strong>Google Firebase</strong> — sign-in, database and notifications (<a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#1d6df2", fontWeight: 700 }}>privacy details</a>).</>,
        <><strong>Cloudflare</strong> — hosts the website and the service that sends notifications.</>,
        <><strong>GitHub</strong> — hosts some open data we use (for example tafsir and mosque data) and the app update files. Checking for updates contacts GitHub.</>,
        <><strong>OpenStreetMap</strong> — map tiles and mosque locations, © OpenStreetMap contributors.</>,
        <><strong>AlAdhan API</strong> — used for prayer times when they cannot be calculated on the device.</>,
      ]} />
      <P>These services receive technical information such as your IP address when your phone contacts them. Each has its own privacy policy.</P>

      <H2>5. How We Use Information</H2>
      <UL items={[
        "To sign you in and keep your profile and saved items",
        "To let Imams publish and update masjid timings",
        "To give you prayer times, Qibla and nearby mosques",
        "To send the prayer notifications you asked for",
        "To fix problems and improve the app",
      ]} />

      <H2>6. What We Do Not Do</H2>
      <UL items={[
        "We do not sell, rent or trade your personal data",
        "We do not show advertisements",
        "We do not collect your contacts, photos, files, phone number or payment details",
        "We do not build a record of your location history",
      ]} />

      <H2>7. Security and Retention</H2>
      <P>
        Data in Firebase is protected with industry-standard encryption in transit and at rest. We keep your account
        information until you ask us to remove it. No system is perfectly secure, so please protect your own Google account.
      </P>

      <H2>8. Your Choices and Deletion</H2>
      <P>
        You can sign out at any time, clear the app's data from your phone settings, or withdraw location and notification
        permissions. To have your account and related data removed, email us from the address you signed up with and we will
        delete it.
      </P>

      <H2>9. Children</H2>
      <P>StepTuDeen is suitable for all ages. We do not knowingly collect personal data from children under 13 without a parent's consent.</P>

      <H2>10. Changes</H2>
      <P>We may update this policy as the app grows. The date at the top shows the latest version, and continued use means you accept the update.</P>

      <H2>11. Contact</H2>
      <P>Questions about privacy? Write to us at <MailLink />.</P>
    </InfoPage>
  );
}
