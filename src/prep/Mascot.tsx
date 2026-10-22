import "./mascot.css";

// The flame mascot. One image per costume x mood (src/prep/mascot/<costume>-<mood>.webp, cut from the artwork sheet);
// a costume that has no picture for a mood falls back to the plain flame with that mood.
export type Mood = "happy" | "cheer" | "think" | "sad" | "wave";
export type Costume = "none" | "teacher" | "police" | "vocational" | "bkk";
export type Motion = "idle" | "pop" | "cheer" | "shake" | "still";

const FILES = import.meta.glob("./mascot/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const mascotSrc = (costume: Costume, mood: Mood) =>
  FILES[`./mascot/${costume}-${mood}.webp`] ?? FILES[`./mascot/none-${mood}.webp`] ?? FILES["./mascot/none-happy.webp"];

type Props = { mood?: Mood; costume?: Costume; size?: number; motion?: Motion; className?: string; alt?: string };

export default function Mascot({ mood = "happy", costume = "none", size = 96, motion = "idle", className = "", alt }: Props) {
  return (
    <img
      src={mascotSrc(costume, mood)} width={size} height={size} alt={alt ?? ""} aria-hidden={alt ? undefined : true}
      className={`pp-mascot pp-mascot-${motion} ${className}`} decoding="async" draggable={false}
    />
  );
}
