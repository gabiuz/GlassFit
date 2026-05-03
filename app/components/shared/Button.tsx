type ButtonVariant =
  | "lightGradWhiteText"
  | "lightGradDarkText"
  | "darkGradBlueText"
  | "darkGradWhiteText"
  | "whiteBtnBlackText"
  | "whiteBtnBlueText"
  | "blackBtnWhiteText"
  | "blueBtnBlackText"
  | "blackOutline"
  | "whiteOutline"
  | "blueBtnWhiteText";

const baseStyle: React.CSSProperties = {
  display: "flex",
  width: "fit-content",
  alignItems: "center",
  gap: "15px",
  padding: "20px 30px",
  borderRadius: "25px",
  fontWeight: 400,
  fontSize: "20px",
  fontStyle: "normal",
  lineHeight: "140%",
  letterSpacing: "-0.38px",
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
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
  whiteBtnBlackText: {
    color: "var(--color-black)",
    backgroundColor: "var(--color-white)",
  },
  whiteBtnBlueText: {
    color: "var(--color-blue)",
    backgroundColor: "var(--color-white)",
  },
  blackBtnWhiteText: {
    color: "var(--color-white)",
    backgroundColor: "var(--color-black)",
  },
  blueBtnBlackText: {
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
  blueBtnWhiteText: {
    color: "var(--color-white)",
    backgroundColor: "var(--color-blue)",
  },
};

const iconStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "1.2rem",
  height: "1.2rem",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.85rem",
  fontWeight: 700,
  textTransform: "uppercase",
};

type ButtonProps = {
  variant?: ButtonVariant;
  leftArrow?: React.ReactNode;
  rightArrow?: React.ReactNode;
  value: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export default function Button({
  variant = "lightGradWhiteText",
  leftArrow,
  rightArrow,
  value,
  className,
  style,
  ...props
}: ButtonProps) {
  const defaultArrow = (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 0V25H25V0H0ZM3.55647 2.08333L12.5 11.0269L21.4435 2.08333H3.55647ZM22.9167 3.55647L13.9731 12.5L22.9167 21.4435V3.55647ZM21.4435 22.9167L12.5 13.9731L3.55647 22.9167H21.4435ZM2.08333 21.4435L11.0269 12.5L2.08333 3.55647V21.4435Z"
        fill="currentColor"
      />
    </svg>
  );
  const resolvedLeftArrow = leftArrow === undefined ? defaultArrow : leftArrow;
  const resolvedRightArrow =
    rightArrow === undefined ? defaultArrow : rightArrow;
  const classes = ["btn", className].filter(Boolean).join(" ");
  const mergedStyle = { ...baseStyle, ...variantStyles[variant], ...style };

  return (
    <button className={classes} style={mergedStyle} {...props}>
      {resolvedLeftArrow !== null ? (
        <span style={iconStyle} aria-hidden="true">
          {resolvedLeftArrow}
        </span>
      ) : null}
      <span className="btn-label">{value}</span>
      {resolvedRightArrow !== null ? (
        <span style={iconStyle} aria-hidden="true">
          {resolvedRightArrow}
        </span>
      ) : null}
    </button>
  );
}
