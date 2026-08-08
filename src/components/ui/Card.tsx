type CardProps = {
  number: string | number;
  title: string;
  description?: string;
  isActive?: boolean;
  className?: string;
};

export default function Card({
  number,
  title,
  description,
  isActive,
  className = "",
}: CardProps) {
  const showActiveState = isActive ?? Boolean(description);
  const showDescription = Boolean(description) && showActiveState;

  return (
    <div
      className={`relative flex w-96 overflow-hidden px-7 pt-10 pb-36 flex-col gap-4 rounded-[25px_25px_0_0] bg-black text-white ${className}`}
    >
      <div
        className={`absolute inset-0 bg-grad-light ${
          showActiveState ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="relative z-10 flex flex-col items-start gap-5 ">
        <div className="text-white text-5xl font-medium capitalize leading-[57.60px]">
          {number}
        </div>
        <div className="flex flex-col gap-8.5">
          <h3 className="text-3xl font-medium leading-10 text-white">
            {title}
          </h3>
        </div>
      </div>
      {description ? (
        <p
          className={`relative z-10 overflow-hidden text-base leading-7 text-white/70 ${
            showDescription
              ? "max-h-40 opacity-100"
              : "max-h-0 opacity-0"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
