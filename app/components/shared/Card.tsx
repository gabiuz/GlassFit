type CardVariant =
  | "lightGradWhiteText"
  | "lightGradDarkText"
  | "darkGradBlueText"
  | "darkGradWhiteText"
  | "whiteCardBlackText"
  | "whiteCardBlueText"
  | "blackCardWhiteText"
  | "blueCardBlackText"
  | "blackOutline"
  | "whiteOutline"
  | "blueCardWhiteText";

const baseStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "24px",
  borderRadius: "20px",
};

const variantStyles: Record<CardVariant, React.CSSProperties> = {
  lightGradWhiteText: {
    color: "var(--color-white)",
    backgroundImage: "var(--grad-light)",
  },
  lightGradDarkText: {
    color: "var(--color-black)",
    backgroundImage: "var(--grad-light)",
  },
  darkGradBlueText: {
    color: "var(--color-blue)",
    backgroundImage: "var(--grad-dark)",
  },
  darkGradWhiteText: {
    color: "var(--color-white)",
    backgroundImage: "var(--grad-dark)",
  },
  whiteCardBlackText: {
    color: "var(--color-black)",
    backgroundColor: "var(--color-white)",
  },
  whiteCardBlueText: {
    color: "var(--color-blue)",
    backgroundColor: "var(--color-white)",
  },
  blackCardWhiteText: {
    color: "var(--color-white)",
    backgroundColor: "var(--color-black)",
  },
  blueCardBlackText: {
    color: "var(--color-black)",
    backgroundColor: "var(--color-blue)",
  },
  blackOutline: {
    color: "var(--color-black)",
    backgroundColor: "transparent",
    border: "1px solid var(--color-black)",
  },
  whiteOutline: {
    color: "var(--color-white)",
    backgroundColor: "transparent",
    border: "1px solid var(--color-white)",
  },
  blueCardWhiteText: {
    color: "var(--color-white)",
    backgroundColor: "var(--color-blue)",
  },
};

type CardProps = {
  title: string;
  subtitle?: string;
  description?: string;
  variant?: CardVariant;
  radius?: React.CSSProperties["borderRadius"];
  backgroundImageUrl?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function Card({
  title,
  subtitle,
  description,
  variant = "whiteCardBlackText",
  radius,
  backgroundImageUrl,
  className,
  style,
}: CardProps) {
  const backgroundStyle = backgroundImageUrl
    ? {
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {};
  const mergedStyle = {
    ...baseStyle,
    ...variantStyles[variant],
    ...backgroundStyle,
    ...(radius ? { borderRadius: radius } : {}),
    ...style,
  };

  return (
    <div className={className} style={mergedStyle}>
      <div className="flex flex-col gap-2">
        {subtitle ? (
          <p className="text-sm uppercase tracking-[0.2em] opacity-70">
            {subtitle}
          </p>
        ) : null}
        <h3 className="text-2xl font-semibold">{title}</h3>
      </div>
      {description ? <p className="text-sm opacity-80">{description}</p> : null}
    </div>
  );
}
