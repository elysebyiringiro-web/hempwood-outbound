import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export const instant = false;

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand auth-brand">
          <span className="brand-mark">|||</span>
          <span>
            <b>HEMPWOOD</b>
            <small>OUTBOUND CRM</small>
          </span>
        </div>
        <span className="auth-kicker">PRIVATE TEAM WORKSPACE</span>
        <h1>Turn early-stage projects into timely conversations.</h1>
        <p>
          Sign in with an approved team email to access the campaign dashboard,
          contacts, projects, and follow-up queue.
        </p>
        <div className="auth-points">
          <span>✓ Project-specific outreach</span>
          <span>✓ One coordinated sequence per person</span>
          <span>✓ Clear follow-ups and handovers</span>
        </div>
      </section>
      <section className="auth-card">
        <Suspense fallback={<p className="auth-loading">Loading sign in…</p>}>
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
          />
        </Suspense>
      </section>
    </main>
  );
}
