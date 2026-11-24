import type { Metadata } from 'next'
import { LegalPage } from '@/components/LegalPage'

export const metadata: Metadata = { title: 'Privacy Policy · NomLog' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="24 November 2026">
      <p>
        NomLog is a personal, non-commercial food-logging project built by an
        individual developer. This page explains, in plain language, what
        information it handles.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Sign-in details:</strong> your name and email address (and
            profile picture, if Google shares it) when you sign in with Google.
            We never see your Google password.
          </li>
          <li>
            <strong>What you log:</strong> meals, water, weight and the profile
            details you enter, such as calorie goals.
          </li>
        </ul>
      </section>

      <section>
        <h2>How it is used</h2>
        <p>
          Only to run the app for you: showing your log, totals and trends. We do
          not sell your data and we do not show ads.
        </p>
      </section>

      <section>
        <h2>Services that process your data</h2>
        <ul>
          <li>Google: sign-in.</li>
          <li>Supabase: stores your account and logs.</li>
          <li>Vercel: hosts the app.</li>
          <li>
            Google Gemini API: when you log a meal, the text you typed or spoke
            is sent to Gemini to turn it into an estimate of food items and
            nutrition. It is processed under Google&apos;s Gemini API terms.
          </li>
        </ul>
      </section>

      <section>
        <h2>Your control</h2>
        <p>
          From the Profile screen you can export your meal history as a CSV file
          and permanently delete your account. Deleting your account removes your
          logs and profile.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Use the developer contact email shown on the Google sign-in screen.
        </p>
      </section>
    </LegalPage>
  )
}
