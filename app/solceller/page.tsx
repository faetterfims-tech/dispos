import type { Metadata } from "next";
import SolarDashboard from "./SolarDashboard";

export const metadata: Metadata = { title: "Solceller" };

export default function SolcellerPage() {
  return (
    <>
      <h1>Solceller</h1>
      <SolarDashboard />
    </>
  );
}
