import { SignOutButton } from "@clerk/nextjs";

export default function NotAuthorizedPage() {
  return <main className="access-denied"><div className="brand auth-brand"><span className="brand-mark">|||</span><span><b>HEMPWOOD</b><small>OUTBOUND CRM</small></span></div><span>ACCESS REQUIRED</span><h1>This email has not been invited.</h1><p>Ask the campaign administrator to add your email address, then sign in again using that address.</p><SignOutButton redirectUrl="/sign-in"><button className="primary">Sign out</button></SignOutButton></main>;
}
