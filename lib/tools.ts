/**
 * Værktøjerne i dispos. Et nyt værktøj = en mappe under /app + en linje her.
 */
export interface Tool {
  href: string;
  name: string;
  description: string;
  icon: string;
}

export const tools: Tool[] = [
  {
    href: "/solceller",
    name: "Solceller",
    description: "Hvad anlægget og batterierne faktisk sparer, time for time.",
    icon: "☀️",
  },
];
