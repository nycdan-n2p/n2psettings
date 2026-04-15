/**
 * Stylized setup assistant mark — net2phone palette (slate + electric blue).
 * Abstract robot / lens motif for the welcome landing & concierge header.
 */
export function WelcomeAgentAvatar({ className = "", size = 40 }: { className?: string; size?: number }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="welcomeAvatarBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1a73e8" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" className="fill-[#1e293b]" />
      <circle cx="24" cy="22" r="10" className="fill-white/95" />
      <circle cx="24" cy="22" r="4" className="fill-[#0f172a]" />
      <rect x="21" y="6" width="6" height="5" rx="1" className="fill-[#334155]" />
      <circle cx="24" y="5" r="2" fill="url(#welcomeAvatarBlue)" />
      <path
        d="M14 34h20"
        stroke="url(#welcomeAvatarBlue)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="30" r="3" fill="url(#welcomeAvatarBlue)" />
      <circle cx="32" cy="30" r="3" fill="url(#welcomeAvatarBlue)" />
    </svg>
  );
}
