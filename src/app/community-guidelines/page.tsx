import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Community guidelines - KinSpace',
  description: 'How we keep KinSpace a warm, safe, and respectful place to heal together.',
}

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Lead with kindness',
    body: [
      'Everyone here is carrying something. Assume good intent, be gentle, and respond the way you would want someone to respond to you on your hardest day.',
    ],
  },
  {
    title: 'Share experience, not prescriptions',
    body: [
      'You can share what helped you, but please don’t tell others to start, stop, or change a treatment. We separate lived experience from medical advice - only a qualified professional can advise on your care.',
    ],
  },
  {
    title: 'Protect privacy - yours and others’',
    body: [
      'Don’t share anyone’s identity, photos, or health details without consent. You’re always welcome to post anonymously. What’s shared in KinSpace stays in KinSpace.',
    ],
  },
  {
    title: 'No harm, harassment, or hate',
    body: [
      'Zero tolerance for harassment, bullying, hate speech, or content that encourages self-harm, eating disorders, or substance misuse. This keeps the space safe for people in recovery and crisis.',
    ],
  },
  {
    title: 'Keep it real and safe',
    body: [
      'No spam, scams, selling, or unverified miracle cures. Don’t impersonate professionals or organisations.',
    ],
  },
  {
    title: 'When someone is in danger',
    body: [
      'If you see someone in crisis, respond with compassion and point them to /crisis. Use the report button for anything that worries you - our team reviews every report.',
    ],
  },
]

export default function CommunityGuidelinesPage() {
  return (
    <main className="page-shell">
      <div className="page-container max-w-2xl">
        <header className="py-6">
          <h1 className="text-3xl font-bold text-brand-background">Community guidelines</h1>
          <p className="mt-3 text-brand-background/70">
            KinSpace works because of the care we show each other. A few promises we ask everyone to keep:
          </p>
        </header>

        <div className="space-y-6">
          {SECTIONS.map((section, index) => (
            <section key={section.title} className="rounded-2xl border border-brand-background/10 bg-brand-primary/40 p-5">
              <h2 className="text-lg font-semibold text-brand-background">
                {index + 1}. {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-relaxed text-brand-background/70">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-brand-background/55">
          Breaking these guidelines may lead to content removal or account suspension. We’d always rather help you stay -
          reach out if you’re struggling.
        </p>
      </div>
    </main>
  )
}
