import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export const instant = false;

export default function SignUpPage() {
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
        <span className="auth-kicker">INVITED TEAM MEMBERS ONLY</span>
        <h1>Create your campaign workspace account.</h1>
        <p>
          Use an email address on the approved team list. Access is checked
          again before any CRM data is loaded.
        </p>
      </section>
      <section className="auth-card">
        <Suspense fallback={<p className="auth-loading">Loading sign up…</p>}>
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
          />
        </Suspense>
      </section>
    </main>
  );
}
