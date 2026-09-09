"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, List } from "lucide-react";
import { PRIVACY_SECTIONS } from "./privacyData";

export function TableOfContents() {
  const [activeId, setActiveId] = useState<string>("introduction");
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // Account for navbar offset

      for (let i = PRIVACY_SECTIONS.length - 1; i >= 0; i--) {
        const section = document.getElementById(PRIVACY_SECTIONS[i].id);
        if (section) {
          const top = section.offsetTop;
          if (scrollPosition >= top) {
            startTransition(() => {
              setActiveId(PRIVACY_SECTIONS[i].id);
            });
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    const navOffset = 140; // Clearance for the floating navbar and sticky card alignment
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - navOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });

    setActiveId(id);
    setIsOpenMobile(false);
  };

  const activeLabel =
    PRIVACY_SECTIONS.find((s) => s.id === activeId)?.tocLabel || "Table of Contents";

  return (
    <>
      {/* Mobile Sticky Floating / Quick Jump Bar */}
      <div className="block lg:hidden mb-8 sticky top-20 z-30">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md border border-neutral-200">
          <button
            type="button"
            onClick={() => setIsOpenMobile((prev) => !prev)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
            aria-expanded={isOpenMobile}
            aria-controls="mobile-toc-list"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <List className="w-5 h-5 text-green shrink-0" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                  Jump to Section
                </p>
                <p className="text-sm font-semibold text-[#1e1c1c] truncate">
                  {activeLabel}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-neutral-500 transition-transform duration-200 shrink-0 ${
                isOpenMobile ? "rotate-180" : ""
              }`}
            />
          </button>

          {isOpenMobile && (
            <div
              id="mobile-toc-list"
              className="mt-4 pt-4 border-t border-neutral-100 max-h-72 overflow-y-auto flex flex-col gap-2"
            >
              {PRIVACY_SECTIONS.map((section) => {
                const isActive = activeId === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                      isActive
                        ? "bg-green/10 text-green font-medium"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {section.tocLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Sticky Table of Contents Card */}
      <aside className="hidden lg:block w-[360px] xl:w-[420px] shrink-0 self-stretch">
        <div className="sticky top-32 xl:top-36 bg-white rounded-[20px] p-6 xl:p-8 shadow-[0px_4px_25px_rgba(0,0,0,0.06)] border border-neutral-100">
          <h2 className="font-medium text-[26px] xl:text-[32px] text-[#1e1c1c] tracking-tight mb-6">
            Table of Contents
          </h2>
          <nav
            aria-label="Table of Contents"
            className="flex flex-col items-start gap-3.5 xl:gap-[30px]"
          >
            {PRIVACY_SECTIONS.map((section) => {
              const isActive = activeId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`w-fit text-left text-[16px] xl:text-[18px] leading-[1.35] tracking-tight transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                    isActive
                      ? "text-green font-medium"
                      : "text-[#1e1c1c] font-normal hover:text-green"
                  }`}
                >
                  {section.tocLabel}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
