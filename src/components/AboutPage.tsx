import { InfoPage, P, Callout, H2, InfoCard } from "./InfoLayout";

interface AboutProps { onBack?: () => void }

export default function AboutPage({ onBack }: AboutProps) {
  return (
    <InfoPage title="About StepTuDeen" meta="Established: 2026 · Made in Pakistan" onBack={onBack}>
      <P>
        <strong>StepTuDeen</strong> is a free Islamic companion app that brings the Quran, Hadith, daily
        duas, prayer times, Qibla direction and your local masjid together in one place. Our mission is to make
        the teachings of the Quran and Sunnah easy to reach for every Muslim, in their own language, on any phone,
        without barriers.
      </P>

      <Callout label="Our Vision:">
        To serve the Muslim Ummah through a modern, clean and trustworthy app that works wherever you are,
        and that keeps your masjid and your daily worship just one tap away.
      </Callout>

      <H2>What We Offer</H2>

      <InfoCard title="Holy Quran">
        The complete Arabic text with translations in 11 languages (Bengali, English, French, Hindi, Indonesian,
        Russian, Spanish, Swedish, Turkish, Urdu and Chinese), audio recitation, tafsir and bookmarks.
      </InfoCard>
      <InfoCard title="Hadith Books">
        Seven major collections: Sahih al-Bukhari, Sahih Muslim, Sunan Abu Dawud, Jami at-Tirmidhi, Sunan an-Nasai,
        Sunan Ibn Majah and Muwatta Imam Malik, with translations in up to nine languages and hadith grading where
        available.
      </InfoCard>
      <InfoCard title="Masnoon Duas">
        Daily supplications and remembrances from <em>Hisn al-Muslim</em> in Arabic, English, Urdu and Hindi, with
        transliteration and a repeat count for each dua.
      </InfoCard>
      <InfoCard title="99 Names of Allah">
        Asma ul Husna with Arabic, transliteration and meanings in Urdu, English and Hindi.
      </InfoCard>
      <InfoCard title="Prayer Times & Notifications">
        Prayer times for your location, jamaat times set by your masjid, and prayer notifications with your choice
        of azan, spoken voice or a simple tone.
      </InfoCard>
      <InfoCard title="Qibla Compass">
        A live compass that points to the Kaaba from wherever you are, using your phone's built-in sensors.
      </InfoCard>
      <InfoCard title="Masjid Finder & Imam Panel">
        Find mosques near you on the map. Imams can register their masjid, publish accurate jamaat and Eid timings,
        and keep their community informed in real time.
      </InfoCard>
      <InfoCard title="Digital Tasbih">
        A simple counter for your dhikr that remembers your count.
      </InfoCard>

      <H2>Our Promise</H2>
      <P>
        StepTuDeen is free, has no advertisements, and does not sell your data. We rely on well-known open sources
        for religious texts and map data, and we welcome corrections from our users. If you find a mistake, please
        tell us through the Contact Us page and we will review it promptly.
      </P>
      <P>May Allah accept this effort and make it a source of benefit for the Ummah. Ameen.</P>
    </InfoPage>
  );
}
