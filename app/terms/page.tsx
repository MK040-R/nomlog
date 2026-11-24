import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = { title: 'Terms of Service · NomLog' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="24 November 2026">
      <p>
        NomLog is a personal, non-commercial project. By using it you agree to
        these short terms.
      </p>

      <section>
        <h2>Not medical advice</h2>
        <p>
          Calorie and nutrition figures are AI-generated estimates and can be
          wrong. NomLog is not medical or dietary advice. Talk to a qualified
          professional about your health.
        </p>
      </section>

      <section>
        <h2>Use it fairly</h2>
        <p>
          Don&apos;t attempt to break, overload or gain unauthorised access to
          the service or to other people&apos;s data.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          The service is provided &quot;as is&quot;, with no promise of
          availability or accuracy. It may change, pause or shut down at any
          time, so keep your own copy of anything important (you can export your
          meals from the Profile screen).
        </p>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          How your information is handled is described in the{' '}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>
          . You can delete your account at any time from the Profile screen.
        </p>
      </section>
    </LegalPage>
  )
}
