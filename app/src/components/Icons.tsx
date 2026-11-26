import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function AuraLogoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7a5 5 0 0 1 5 5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function TodayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </IconBase>
  );
}

export function CheckInIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 12h-4l-3 7-4-14-3 7H2" />
    </IconBase>
  );
}

export function FoodIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 3v7a3 3 0 0 0 6 0V3" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M17 3a4 4 0 0 1 0 8" />
    </IconBase>
  );
}

export function GoalsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function AskIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </IconBase>
  );
}

export function DataIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
      <path d="M9.5 12l2 2 3.5-3.5" />
    </IconBase>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </IconBase>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </IconBase>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </IconBase>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconBase>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 18c-6.5 0-10-6-10-6a18.4 18.4 0 0 1 4.2-4.8" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 6c6.5 0 10 6 10 6a18.4 18.4 0 0 1-2.1 2.9" />
      <path d="M2 2l20 20" />
    </IconBase>
  );
}

export function ChevronIcon({ open, ...props }: IconProps & { open?: boolean }) {
  return (
    <IconBase {...props}>
      <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </IconBase>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" />
    </IconBase>
  );
}
