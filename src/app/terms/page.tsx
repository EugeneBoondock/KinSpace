import type { Metadata } from 'next'
import Link from 'next/link'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Terms & Conditions · KinSpace',
  description:
    'The terms that govern your use of KinSpace, a peer-support and health-information platform. KinSpace is not a medical provider and does not give medical advice.',
}

const LAST_UPDATED = '22 June 2026'

export default function TermsPage() {
  return (
    <PageFrame containerClassName="max-w-3xl">
      <article className="space-y-8 pb-12">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Legal</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-ink sm:text-3xl">Terms &amp; Conditions</h1>
          <p className="text-sm text-brand-ink/55">Last updated {LAST_UPDATED}</p>
        </header>

        <div className="rounded-2xl border border-brand-crisis/30 bg-brand-crisis/[0.06] p-4 text-sm leading-relaxed text-brand-ink/80">
          <strong className="font-semibold text-brand-ink">KinSpace is not a medical provider.</strong> Nothing on
          KinSpace is medical advice, diagnosis, or treatment. Always speak to a qualified clinician about your health,
          and in an emergency call your local emergency services immediately. See <Link href="/crisis" className="font-semibold text-brand-crisis hover:underline">crisis support</Link>.
        </div>

        <Section title="1. About these terms">
          <p>
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of KinSpace, operated by
            Boondock Labs (&ldquo;KinSpace&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using
            the platform, you agree to these Terms and to our{' '}
            <Link href="/privacy" className="font-semibold text-brand-accent2 hover:underline">Privacy Policy</Link> and{' '}
            <Link href="/community-guidelines" className="font-semibold text-brand-accent2 hover:underline">Community Guidelines</Link>.
            If you do not agree, please do not use KinSpace.
          </p>
        </Section>

        <Section title="2. What KinSpace is, and is not">
          <p>
            KinSpace is a peer-support community and a health-<em>information</em> platform. We help you find what others
            living with a condition have tried, summarise published research in plain language, and connect you with
            peers, groups, and nearby services.
          </p>
          <p>
            KinSpace does <strong>not</strong> provide medical care, does not employ your treating clinicians, and does
            not create a doctor–patient relationship. Treatment effectiveness, symptom, and research information is a
            starting point for your own conversations with a qualified professional, never a substitute for one.
          </p>
        </Section>

        <Section title="3. Eligibility">
          <p>
            You must be at least 18 years old, or 13 or older with the consent and supervision of a parent or legal
            guardian, to use KinSpace. By using the platform you confirm you meet these requirements.
          </p>
        </Section>

        <Section title="4. Your account">
          <p>
            You are responsible for the activity on your account and for keeping your login credentials secure. Provide
            accurate information when you register, and let us know promptly if you believe your account has been
            compromised. You may close your account at any time from your settings.
          </p>
        </Section>

        <Section title="5. Community conduct">
          <p>
            KinSpace is a place for support, not harm. You agree not to harass, impersonate, or endanger others; not to
            share content that is unlawful, hateful, or deliberately misleading about health; and not to use the
            platform to sell or promote unproven cures. Detailed expectations live in our{' '}
            <Link href="/community-guidelines" className="font-semibold text-brand-accent2 hover:underline">Community Guidelines</Link>,
            which form part of these Terms. We may remove content or suspend accounts that put the community at risk.
          </p>
        </Section>

        <Section title="6. Content you share">
          <p>
            You keep ownership of what you post. By posting, you grant KinSpace a non-exclusive licence to store and
            display that content so the platform can function (for example, showing your post to the group you shared it
            with). You can edit or delete your content, and deleting it removes it from public view. Do not post another
            person&rsquo;s private health information without their consent.
          </p>
        </Section>

        <Section title="7. Crisis &amp; emergencies">
          <p>
            KinSpace is not an emergency service and cannot guarantee a timely response from peers or staff. If you or
            someone else is in danger, contact emergency services. In South Africa you can reach the SADAG mental-health
            line on <strong>0800 567 567</strong> or the Suicide Crisis Line on <strong>0800 12 13 14</strong>. More
            options are on our <Link href="/crisis" className="font-semibold text-brand-crisis hover:underline">crisis page</Link>.
          </p>
        </Section>

        <Section title="8. Privacy">
          <p>
            We treat health information with particular care. How we collect, use, and protect your data, and the
            rights you have over it under POPIA and the GDPR, is described in our{' '}
            <Link href="/privacy" className="font-semibold text-brand-accent2 hover:underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="9. Third-party services">
          <p>
            KinSpace links to and integrates third-party services (for example, maps, research databases, and payment
            providers). We are not responsible for the content or practices of those services, and your use of them is
            governed by their own terms.
          </p>
        </Section>

        <Section title="10. Disclaimers &amp; limitation of liability">
          <p>
            KinSpace is provided &ldquo;as is&rdquo;. To the fullest extent permitted by law, we disclaim warranties of
            accuracy, fitness for a particular purpose, and uninterrupted availability, and we are not liable for
            decisions you make based on information found on the platform. Nothing in these Terms excludes liability that
            cannot lawfully be excluded.
          </p>
        </Section>

        <Section title="11. Changes to these terms">
          <p>
            We may update these Terms as the platform evolves. When we make material changes, we will update the date
            above and, where appropriate, notify you in the app. Continued use after changes take effect means you accept
            the updated Terms.
          </p>
        </Section>

        <Section title="12. Governing law">
          <p>
            These Terms are governed by the laws of the Republic of South Africa, and you agree to the non-exclusive
            jurisdiction of its courts.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Email us at{' '}
            <a href="mailto:hello@kinspace.co.za" className="font-semibold text-brand-accent2 hover:underline">hello@kinspace.co.za</a>.
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
