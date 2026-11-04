import type { ReactNode } from "react";

export function SectionHeading({
  kicker,
  title,
  children,
  id,
  align = "center",
}: {
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
  id: string;
  align?: "center" | "left";
}) {
  const center = align === "center";
  return (
    <div
      className={
        center
          ? "mx-auto flex max-w-2xl flex-col items-center text-center"
          : "flex max-w-xl flex-col items-start"
      }
    >
      <p className="rounded-full bg-kicker px-4 py-1.5 text-sm font-semibold tracking-tight text-kicker-foreground ring-1 ring-kicker-foreground/15">
        {kicker}
      </p>
      <h2
        id={id}
        className="mt-4 font-display text-[clamp(2rem,4.4vw,3.6rem)] font-extrabold leading-[0.98] tracking-[-0.05em] text-balance text-foreground"
      >
        {title}
      </h2>
      {children && (
        <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">{children}</p>
      )}
    </div>
  );
}
