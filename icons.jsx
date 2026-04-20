// Custom thin-line SVG icons (1.5px stroke)
const Icon = ({ children, size = 16, stroke = "currentColor", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const IconSun = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Icon>
);

const IconShield = (p) => (
  <Icon {...p}>
    <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />
  </Icon>
);

const IconDrop = (p) => (
  <Icon {...p}>
    <path d="M12 2.5s-6 7-6 11.5a6 6 0 0012 0c0-4.5-6-11.5-6-11.5z" />
  </Icon>
);

const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

const IconWind = (p) => (
  <Icon {...p}>
    <path d="M3 8h12a3 3 0 100-6M3 12h18M3 16h15a3 3 0 110 6" />
  </Icon>
);

const IconSunrise = (p) => (
  <Icon {...p}>
    <path d="M17 18a5 5 0 00-10 0M12 2v7M4.22 10.22l1.42 1.42M18.36 11.64l1.42-1.42M2 18h2M20 18h2M22 22H2M8 6l4-4 4 4" />
  </Icon>
);

const IconSunset = (p) => (
  <Icon {...p}>
    <path d="M17 18a5 5 0 00-10 0M12 9V2M4.22 10.22l1.42 1.42M18.36 11.64l1.42-1.42M2 18h2M20 18h2M22 22H2M16 5l-4 4-4-4" />
  </Icon>
);

const IconCloud = (p) => (
  <Icon {...p}>
    <path d="M6 18a4 4 0 01-.88-7.9A6 6 0 0118 10a4 4 0 01-2 7.5H6z" />
  </Icon>
);

const IconWave = (p) => (
  <Icon {...p}>
    <path d="M2 12s2-3 5-3 5 3 8 3 5-3 5-3M2 18s2-3 5-3 5 3 8 3 5-3 5-3" />
  </Icon>
);

const IconAlert = (p) => (
  <Icon {...p}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18h.01" />
  </Icon>
);

const IconPin = (p) => (
  <Icon {...p}>
    <path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" />
    <circle cx="12" cy="9" r="2.5" />
  </Icon>
);

const IconLeaf = (p) => (
  <Icon {...p}>
    <path d="M3 21s0-9 9-13c5-2 9 0 9 0s-2 11-10 13c-5 1-8 0-8 0z" />
    <path d="M3 21c3-5 6-7 10-9" />
  </Icon>
);

const IconSparkle = (p) => (
  <Icon {...p}>
    <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
  </Icon>
);

const IconEye = (p) => (
  <Icon {...p}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

Object.assign(window, {
  Icon, IconSun, IconShield, IconDrop, IconClock, IconWind,
  IconSunrise, IconSunset, IconCloud, IconWave, IconAlert, IconPin,
  IconLeaf, IconSparkle, IconEye
});
