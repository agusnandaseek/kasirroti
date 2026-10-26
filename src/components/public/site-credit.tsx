import { cn } from "@/lib/utils";

export function NandaMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="5"
        y="5"
        width="90"
        height="90"
        rx="15"
        ry="15"
        fill="#FFC93C"
        stroke="#0A0A0A"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path
        d="M 26 24 L 40 24 L 61 56 L 61 24 L 74 24 L 74 76 L 60 76 L 39 44 L 39 76 L 26 76 Z"
        fill="#0A0A0A"
      />
    </svg>
  );
}

export function SiteCredit({ className }: { className?: string }) {
  return (
    <a
      href="https://portofolio.bynanda.my.id/"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap transition hover:opacity-75",
        className,
      )}
    >
      <NandaMark className="size-4 shrink-0" />
      <span>© {new Date().getFullYear()} Nanda Creative</span>
    </a>
  );
}
