type CardProps = {
  number: string | number;
  title: string;
  description?: string;
  className?: string;
};

export default function Card({
  number,
  title,
  description,
  className = "",
}: CardProps) {
  return (
    <div
      className={`flex w-96 px-7 pt-10 pb-36 flex-col gap-4 rounded-[25px_25px_0_0] bg-black  text-white shadow-[0_10px_30px_rgba(4,94,109,0.12)] ${className}`}
    >
      <div className="flex flex-col items-start gap-5 ">
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
        <p className="text-base leading-7 text-white/70">{description}</p>
      ) : null}
    </div>
  );
}
