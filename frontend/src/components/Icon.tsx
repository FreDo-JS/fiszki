import React from 'react';

// A small, self-contained stroke-icon set. Everything inherits `currentColor`
// and the surrounding font size, so icons pick up the theme automatically and
// stay consistent in weight — which emoji never do across platforms.

export type IconName =
  | 'home'
  | 'layers'
  | 'chart'
  | 'shield'
  | 'menu'
  | 'close'
  | 'more'
  | 'search'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'edit'
  | 'copy'
  | 'trash'
  | 'sparkles'
  | 'volume'
  | 'download'
  | 'check'
  | 'cross'
  | 'dash'
  | 'plus'
  | 'flame'
  | 'book'
  | 'clock'
  | 'trending'
  | 'inbox'
  | 'calendar'
  | 'repeat'
  | 'users'
  | 'userCheck'
  | 'userOff'
  | 'target'
  | 'arrowLeft'
  | 'arrowRight'
  | 'checkCircle';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" />,
  layers: <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  shield: <path d="M12 3l7 3v5.5c0 4.4-2.9 8.2-7 9.5-4.1-1.3-7-5.1-7-9.5V6l7-3Z" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  more: <path d="M12 5.5h.01M12 12h.01M12 18.5h.01" strokeWidth={2.5} strokeLinecap="round" />,
  search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3" />,
  sun: <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1.5V4M12 20v2.5M4.2 4.2 6 6M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  logout: <path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />,
  edit: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 7.5l2 2" />,
  copy: <path d="M9 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9ZM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />,
  trash: <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />,
  sparkles: <path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3ZM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />,
  volume: <path d="M11 5 6.5 9H3v6h3.5L11 19V5ZM15.5 9.5a3.5 3.5 0 0 1 0 5M18.5 6.5a7.5 7.5 0 0 1 0 11" />,
  download: <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />,
  check: <path d="m5 12.5 5 5 9-11" />,
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  dash: <path d="M6 12h12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  flame: <path d="M12 22c3.9 0 6.5-2.6 6.5-6.2 0-4.3-4-6.4-4.6-11.3-2 1.3-3.4 3.5-3.4 5.6 0 1-.6 1.7-1.4 1.7-.8 0-1.3-.6-1.5-1.6C6.2 11.6 5.5 13.4 5.5 15.8 5.5 19.4 8.1 22 12 22Z" />,
  book: <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5v-15ZM4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.5l3.5 2" />,
  trending: <path d="m3 16 5.5-5.5 3.5 3.5L21 5M15.5 5H21v5.5" />,
  inbox: <path d="M3 13h4.5l1.5 3h6l1.5-3H21M3 13l3-8h12l3 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />,
  calendar: <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12ZM8 3v4M16 3v4M4 10h16" />,
  repeat: <path d="M17 2.5 20.5 6 17 9.5M20.5 6H7a3.5 3.5 0 0 0-3.5 3.5M7 21.5 3.5 18 7 14.5M3.5 18H17a3.5 3.5 0 0 0 3.5-3.5" />,
  users: <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM17 4a3.75 3.75 0 0 1 0 7M18.5 14.8a4 4 0 0 1 3.5 3.95V20" />,
  userCheck: <path d="M14 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M8 10.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM16 12.5l2 2 4-4.5" />,
  userOff: <path d="M14 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M8 10.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM16.5 9.5l5 5M21.5 9.5l-5 5" />,
  target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  checkCircle: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.2l2.7 2.8L16 9.5" />,
};

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.75,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
