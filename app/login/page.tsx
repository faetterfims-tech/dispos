import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Log ind" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  const error = sp.fejl !== undefined;

  return (
    <div className="login">
      <h1>Log ind</h1>
      <form method="post" action="/api/login" className="card login-card">
        <input type="hidden" name="next" value={next} />
        {/* Brugernavnet er kun med, så telefonens adgangskode-manager kan gemme koden. */}
        <input type="text" name="username" autoComplete="username" defaultValue="dispos" hidden readOnly />
        <label htmlFor="password">Adgangskode</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {error && <p className="login-error">Forkert adgangskode. Prøv igen.</p>}
        <button type="submit">Log ind</button>
        <p className="muted">Du bliver husket på denne enhed.</p>
      </form>
    </div>
  );
}
