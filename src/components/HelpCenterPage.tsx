import { InfoPage, P, Callout, H2, InfoCard, UL, MailLink } from "./InfoLayout";

interface HelpCenterProps { onBack?: () => void }

export default function HelpCenterPage({ onBack }: HelpCenterProps) {
  return (
    <InfoPage title="Help Center" meta="A short guide to every feature" onBack={onBack}>
      <Callout label="Tip:">
        The bottom bar takes you to Hadith, Quran, Mosques and Duas. The home screen has cards for everything else.
        Open the menu (top right) for settings, updates and these pages.
      </Callout>

      <H2>Getting Started</H2>
      <InfoCard title="Home">
        Shows today's date, the next prayer and its countdown, and shortcuts to Quran, Qibla, Tasbih, Duas, 99 Names and
        the Hadith books. Allow location so prayer times match your city.
      </InfoCard>
      <InfoCard title="Settings">
        Open Menu → Settings to refresh your location, pick your notification sound (azan, spoken voice or tone) and
        manage your preferences.
      </InfoCard>

      <H2>Reading & Remembrance</H2>
      <InfoCard title="Quran">
        Choose a surah, read the Arabic with a translation in your language, and listen to the recitation. Use the
        bookmark option to save your place. Reading works without internet; audio and tafsir need a connection.
      </InfoCard>
      <InfoCard title="Hadith">
        Pick a book, then a chapter, then read the hadith in Arabic with a translation. Many hadith show their grade.
        Scroll down to hide the top bar and scroll up slightly to bring it back.
      </InfoCard>
      <InfoCard title="Duas">
        Browse daily supplications from Hisn al-Muslim. Search by title, switch language, and see transliteration and
        how many times to repeat each dua.
      </InfoCard>
      <InfoCard title="99 Names of Allah">
        Open it from the home screen. Switch between Urdu, English and Hindi, and search by name or meaning.
      </InfoCard>
      <InfoCard title="Tasbih">
        Tap to count your dhikr. Your count and chosen dhikr are remembered on your device.
      </InfoCard>

      <H2>Prayer, Qibla & Masjid</H2>
      <InfoCard title="Prayer Times & Notifications">
        Times follow your location, and a masjid can publish its own jamaat times. Choose how you want to be reminded in
        Settings. If notifications are late, set the app to 'Unrestricted' in your phone's battery settings.
      </InfoCard>
      <InfoCard title="Qibla">
        Hold your phone flat, move it in a figure-8 once, then turn until the Kaaba mark lines up with the top marker.
        If it is slightly off, face a known Qibla direction and press the Calibrate button.
      </InfoCard>
      <InfoCard title="Mosques">
        Use Mosques in the bottom bar. Set the search radius and tap 'Find Nearby Mosques' to see masjids around you, or
        search for any area or city.
      </InfoCard>
      <InfoCard title="Imam Panel">
        Sign in with Google, register your masjid and set its location and timings. Your community sees updates as soon as
        you save them.
      </InfoCard>

      <H2>Your Account</H2>
      <InfoCard title="Profile">
        Sign in with Google to keep your favourites and bookmarks with your profile. You can use the rest of the app
        without signing in.
      </InfoCard>
      <InfoCard title="App Updates (Android)">
        When a new version is available you will see an Update button. You can also find it later under Menu → Update
        available.
      </InfoCard>

      <H2>Troubleshooting</H2>
      <UL items={[
        "Location not working: allow Location for StepTuDeen in your phone's app settings.",
        "Wrong Qibla: calibrate the compass with a figure-8 motion and stay away from magnets.",
        "App feels slow: close and reopen it; clearing the app cache also helps (saved items on the device may be removed).",
        "Something looks wrong: tell us what you saw and which screen it was on.",
      ]} />
      <P>Need more help? Email <MailLink /> or use the Contact Us page.</P>
    </InfoPage>
  );
}
