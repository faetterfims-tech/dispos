import type { Metadata } from "next";
import TrainingLog from "./TrainingLog";

export const metadata: Metadata = { title: "Træning" };

export default function TraeningPage() {
  return (
    <>
      <h1>Træning</h1>
      <TrainingLog />
    </>
  );
}
