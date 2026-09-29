import { CLOSING_DISCLAIMER, PRIVACY_SECTIONS } from "./privacyData";

export function PrivacyContent() {
  return (
    <article className="w-full max-w-200 flex flex-col">
      {PRIVACY_SECTIONS.map((section, index) => {
        return (
          <div key={section.id} id={section.id} className="scroll-mt-36">
            <section className="flex flex-col gap-5 xl:gap-6">
              <h2 className="text-3xl sm:text-4xl xl:text-5xl font-medium leading-[1.2] text-black tracking-tight">
                {section.title}
              </h2>

              {section.subtitle && (
                <p className="text-xl sm:text-2xl font-medium text-black/90 tracking-tight">
                  {section.subtitle}
                </p>
              )}

              {section.paragraphs?.map((para, pIdx) => (
                <p
                  key={pIdx}
                  className="text-base sm:text-lg xl:text-[20px] font-normal leading-[1.6] text-black/90 tracking-tight"
                >
                  {para}
                </p>
              ))}

              {section.meta && (
                <p className="text-sm sm:text-base xl:text-[18px] text-neutral-500 font-normal pt-1">
                  {section.meta}
                </p>
              )}

              {section.lead && (
                <p className="text-base sm:text-lg xl:text-[20px] font-normal leading-[1.6] text-black/90 tracking-tight">
                  {section.lead}
                </p>
              )}

              {section.listTitle && (
                <p className="text-base sm:text-lg xl:text-[20px] font-normal leading-[1.6] text-black/90 tracking-tight">
                  {section.listTitle}
                </p>
              )}

              {section.bullets && (
                <ul className="list-disc ms-6 space-y-1.5 text-base sm:text-lg xl:text-[20px] text-black/90 leading-[1.6]">
                  {section.bullets.map((bullet, bIdx) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              )}

              {section.trailing && (
                <p className="text-base sm:text-lg xl:text-[20px] font-normal leading-[1.6] text-black/90 tracking-tight">
                  {section.trailing}
                </p>
              )}

              {section.contacts && (
                <ul className="list-disc ms-6 space-y-2 text-base sm:text-lg xl:text-[20px] text-black/90 leading-[1.6]">
                  {section.contacts.map((contact) => (
                    <li key={contact.label}>
                      <span className="font-bold text-black">
                        {contact.label}{" "}
                      </span>
                      <span className="text-black/90">{contact.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {index < PRIVACY_SECTIONS.length - 1 && (
              <hr className="border border-black my-8 xl:my-12.5" />
            )}
          </div>
        );
      })}

      {/* Closing Legal Disclaimer / Acknowledgment */}
      <hr className="border border-black my-8 xl:my-12.5" />
      <div className="w-full">
        <p className="italic text-base sm:text-lg xl:text-[20px] text-[#1e1c1c] leading-[1.6]">
          {CLOSING_DISCLAIMER}
        </p>
      </div>
    </article>
  );
}
