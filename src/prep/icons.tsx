// Small stroke icons (24px grid) so the UI does not depend on emoji rendering per device.
import type { ReactNode } from "react";
type P = { size?: number };
const svg = (size: number, body: ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
);

export const IconHome = ({ size = 22 }: P) => svg(size, <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>);
export const IconChart = ({ size = 22 }: P) => svg(size, <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>);
export const IconCrown = ({ size = 22 }: P) => svg(size, <><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5z" /></>);
export const IconUser = ({ size = 22 }: P) => svg(size, <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>);
export const IconShield = ({ size = 22 }: P) => svg(size, <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>);
export const IconPlus = ({ size = 20 }: P) => svg(size, <><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconBack = ({ size = 20 }: P) => svg(size, <path d="M15 18 9 12l6-6" />);
export const IconNext = ({ size = 20 }: P) => svg(size, <path d="m9 18 6-6-6-6" />);
export const IconGrid = ({ size = 18 }: P) => svg(size, <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);
export const IconFlag = ({ size = 16 }: P) => svg(size, <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>);
export const IconDownload = ({ size = 20 }: P) => svg(size, <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>);
export const IconCheck = ({ size = 18 }: P) => svg(size, <path d="m5 12 5 5 9-10" />);
export const IconX = ({ size = 18 }: P) => svg(size, <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);
export const IconTarget = ({ size = 22 }: P) => svg(size, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const IconBook = ({ size = 22 }: P) => svg(size, <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M8 7h7" /></>);
export const IconTrophy = ({ size = 22 }: P) => svg(size, <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4" /><path d="M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4" /><path d="M8 21h8" /><path d="M10 17h4v4h-4z" /></>);
export const IconLogout = ({ size = 18 }: P) => svg(size, <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>);

export const Logo = ({ size = 36 }: P) => <img src="/prep-icons/icon-192.png" width={size} height={size} alt="" className="pp-logo-img" />;
export const IconCalendar = ({ size = 22 }: P) => svg(size, <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 10h18" /><path d="M8 14h2" /><path d="M14 14h2" /><path d="M8 17.5h2" /></>);
