export const nf = (n: number) => n.toLocaleString("th-TH");
export const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
