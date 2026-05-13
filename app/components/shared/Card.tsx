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

type CardLayout = "default" | "explore";

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
  number?: string;
  title: string;
  subtitle?: string;
  description?: string;
  variant?: CardVariant;
  layout?: CardLayout;
  radius?: React.CSSProperties["borderRadius"];
  backgroundImageUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function Card({
  number,
  title,
  subtitle,
  description,
  variant = "whiteCardBlackText",
  layout = "default",
  radius,
  backgroundImageUrl,
  imageUrl,
  imageAlt,
  className,
  style,
}: CardProps) {
  const isExploreLayout = layout === "explore";
  const backgroundStyle = backgroundImageUrl
    ? {
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : {};
  const exploreBaseStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    padding: "30px",
    paddingBottom: "0px",
    borderRadius: "25px",
    color: "var(--color-white)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  };
  const mergedStyle = {
    ...(isExploreLayout ? exploreBaseStyle : baseStyle),
    ...(isExploreLayout ? {} : variantStyles[variant]),
    ...backgroundStyle,
    ...(radius ? { borderRadius: radius } : {}),
    ...style,
  };

  if (isExploreLayout) {
    return (
      <div className={className} style={mergedStyle}>
        <div className="flex w-full items-center justify-between">
          <h3 className="text-[32px] font-medium leading-[1.2] tracking-[-0.608px]">
            {title}
          </h3>
          {number ? (
            <div className="rounded-full bg-grad-light px-[25px] py-[10px]">
              <p className="text-[24px] font-normal leading-[1.4] tracking-[-0.456px]">
                {number}
              </p>
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="text-[20px] leading-[1.4] tracking-[-0.38px]">
            {description}
          </p>
        ) : null}
        {imageUrl ? (
          <div className="relative w-full aspect-[364/386] rounded-br-[25px] shadow-[-18px_-18px_30px_-21px_rgba(0,0,0,0.25)]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[25px]">
              <img
                src={imageUrl}
                alt={imageAlt ?? ""}
                className="absolute left-[-31.22%] top-[-17.7%] h-[139.43%] w-[147.57%] max-w-none object-cover"
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className} style={mergedStyle}>
      {number || imageUrl ? (
        <div className="flex items-center justify-between">
          {number ? (
            <p className="text-sm font-semibold tracking-[0.2em] opacity-70">
              {number}
            </p>
          ) : (
            <span />
          )}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={imageAlt ?? ""}
              className="h-10 w-10 object-contain"
            />
          ) : null}
        </div>
      ) : null}
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
