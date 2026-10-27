const kr = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec1 = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtKr = (v: number) => `${kr.format(Math.round(v))} kr`;
export const fmtPrice = (v: number | null) => (v == null ? "–" : `${dec2.format(v)} kr/kWh`);
export const fmtKWh = (v: number) => `${kr.format(Math.round(v))} kWh`;
export const fmtYears = (v: number | null) => (v == null ? "–" : `${dec1.format(v)} år`);
export const fmtPct = (v: number) => `${kr.format(Math.round(v * 100))} %`;

const monthNames = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export const fmtMonth = (key: string) => {
  const [y, m] = key.split("-");
  return `${monthNames[Number(m) - 1]} ${y.slice(2)}`;
};
