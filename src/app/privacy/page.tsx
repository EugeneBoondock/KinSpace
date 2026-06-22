import type { Metadata } from 'next'
import Link from 'next/link'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy · KinSpace',
  description:
    'How KinSpace collects, uses, and protects your data, including the special care we take with health information, and the rights you have under POPIA and the GDPR.',
}

const LAST_UPDATED = '22 June 2026'

export default function PrivacyPage() {
  return (
    <PageFrame containerClassName="max-w-3xl">
      <article className="space-y-8 pb-12">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Legal</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-ink sm:text-3xl">Privacy Policy</h1>
          <p className="text-sm text-brand-ink/55">Last updated {LAST_UPDATED}</p>
        </header>

        <div className="rounded-2xl border border-brand-line bg-brand-surface-raised p-4 text-sm leading-relaxed text-brand-ink/80">
          Your health story is yours. We designed KinSpace so you can take part anonymously, share only what you choose,
          and delete it whenever you want. This policy explains, in plain language, what we do with your data.
        </div>

        <Section title="1. Who we are">
          <p>
            KinSpace is operated by Boondock Labs (&ldquo;KinSpace&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), the
            responsible party / data controller for your information. You can reach us at{' '}
            <a href="mailto:privacy@kinspace.co.za" className="font-semibold text-brand-accent2 hover:underline">privacy@kinspace.co.za</a>.
          </p>
        </Section>

        <Section title="2. What we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Account information</strong>, your email, a username, and authentication details.</li>
            <li><strong>Profile &amp; health information you choose to share</strong>, conditions you follow, symptoms or
              check-ins you log, treatments you rate, posts and messages you write.</li>
            <li><strong>Usage information</strong>, basic, privacy-respecting data about how the app is used, so we can
              keep it working and improve it.</li>
            <li><strong>Location</strong>, only if you use the care map, and only to show services near you. We do not
              track your location in the background.</li>
          </ul>
        </Section>

        <Section title="3. Health &amp; other sensitive information">
          <p>
            Information about your health is &ldquo;special personal information&rdquo; under POPIA and a &ldquo;special
            category&rdquo; under the GDPR. We process it only with your consent and only to provide the features you ask
            for. Private notes, such as therapy session notes and support-request notes, are encrypted. You can post to
            the community under a pseudonym, and you decide what to reveal.
          </p>
        </Section>

        <Section title="4. How we use your information">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To run the platform, your account, community, messages, trackers, and insights.</li>
            <li>To show you relevant condition studies, peers, groups, and nearby services.</li>
            <li>To keep KinSpace safe, detecting abuse, and surfacing crisis resources when a message suggests risk.</li>
            <li>To communicate with you about your account and important changes.</li>
          </ul>
          <p>We do not sell your personal information, and we do not use your health data to target advertising.</p>
        </Section>

        <Section title="5. Legal basis">
          <p>
            Where the GDPR or POPIA applies, we rely on your <strong>consent</strong> for health information, on the
            <strong> performance of our agreement</strong> with you to run the service, and on our
            <strong> legitimate interests</strong> in keeping the platform safe and functional. You can withdraw consent
            at any time by adjusting your settings or deleting the relevant data.
          </p>
        </Section>

        <Section title="6. Who we share it with">
          <p>
            We share data only with service providers who help us run KinSpace (for example, our cloud and database
            host), under contracts that require them to protect it. We may disclose information if required by law or to
            protect someone&rsquo;s safety. We never sell your data.
          </p>
        </Section>

        <Section title="7. Data retention &amp; deletion">
          <p>
            We keep your information for as long as your account is active. You can delete individual posts, logs, and
            messages at any time, or close your account to remove your personal data, subject to limited retention we may
            need for legal or safety reasons.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            We use industry-standard measures to protect your data, including encryption of sensitive notes and secure,
            httpOnly session cookies. No system is perfectly secure, but we work to limit what we hold and to guard it
            carefully.
          </p>
        </Section>

        <Section title="9. Your rights">
          <p>
            You have the right to access, correct, and delete your personal information, to object to or restrict certain
            processing, and to request a copy of your data. Under POPIA you may also lodge a complaint with the
            Information Regulator of South Africa. To exercise any right, email{' '}
            <a href="mailto:privacy@kinspace.co.za" className="font-semibold text-brand-accent2 hover:underline">privacy@kinspace.co.za</a>.
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            KinSpace is not intended for children under 13. If you believe a child has provided us personal information
            without appropriate consent, contact us and we will remove it.
          </p>
        </Section>

        <Section title="11. International transfers">
          <p>
            Our infrastructure may process data in locations outside South Africa. Where it does, we take steps to ensure
            your information receives a comparable level of protection.
          </p>
        </Section>

        <Section title="12. Cookies &amp; local storage">
          <p>
            We use a small number of essential cookies and local storage to keep you signed in and to remember your
            preferences (such as theme and reduced-motion). We do not use third-party advertising trackers.
          </p>
        </Section>

        <Section title="13. Changes to this policy">
          <p>
            We may update this policy as the platform evolves. We will update the date above and, for material changes,
            notify you in the app.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Questions or requests about your privacy? Email{' '}
            <a href="mailto:privacy@kinspace.co.za" className="font-semibold text-brand-accent2 hover:underline">privacy@kinspace.co.za</a>.
            See also our <Link href="/terms" className="font-semibold text-brand-accent2 hover:underline">Terms &amp; Conditions</Link>.
          </p>
        </Section>
      </article>

      <BottomNav />
      <Footer />
    </PageFrame>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-brand-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-brand-ink/70">{children}</div>
    </section>
  )
}
