import Link from "next/link";
import { tools } from "@/lib/tools";

export default function Home() {
  return (
    <>
      <h1>Værktøjer</h1>
      <div className="tool-grid">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="card tool-card">
            <span className="tool-icon" aria-hidden>
              {t.icon}
            </span>
            <span>
              <strong>{t.name}</strong>
              <span className="muted">{t.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
