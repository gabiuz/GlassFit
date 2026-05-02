"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as motion from "motion/react-client";

const navLinks = [
  "Home",
  "About",
  "Product Catalog",
  "Visualization Workspace",
];

type classnamePropse = {
  className?: string;
};

export default function Navbar({ className = "" }: classnamePropse) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  return (
    <nav
      className={`bg-white/75 border border-green rounded-[30px] px-18.75 py-5 flex justify-between items-center shadow-[-5px_4px_30px_0px_rgba(4,94,109,0.30)] ${className}`}
    >
      <div className="navbar-logo">
        <button className="navbar-icon" aria-label="Menu">
          <Image
            src="/Logo.svg"
            alt=""
            width={181}
            height={77}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className="navbar-links flex gap-15">
        {navLinks.map((label) => {
          const isActive =
            label === "Home" &&
            (hoveredLabel === null || hoveredLabel === "Home");

          return (
            <motion.span
              key={label}
              initial="rest"
              animate={isActive ? "active" : "rest"}
              whileHover="hover"
              className="relative inline gap-2.5-flex items-center"
              onMouseEnter={() => setHoveredLabel(label)}
              onMouseLeave={() => setHoveredLabel(null)}
            >
              <Link
                href="#"
                className={`text-lg leading -4 navbar-link flex hover:text-green ${isActive ? "text-green font-bold" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
              <motion.span
                className="pointer-events-none absolute left-1/2 -bottom-1 h-0.5 -translate-x-1/2 rounded-full"
                variants={{
                  rest: {
                    width: "12px",
                    backgroundColor: "var(--color-black)",
                  },
                  hover: {
                    width: "100%",
                    backgroundColor: "var(--color-green)",
                  },
                  active: {
                    width: "100%",
                    backgroundColor: "var(--color-green)",
                  },
                }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </motion.span>
          );
        })}
      </div>
      <div className="flex items-center gap-6.25">
        <button>
          <Image
            src="/settings.svg"
            alt=""
            width={35}
            height={25}
            aria-hidden="true"
          />
        </button>
        <button>
          <Image
            src="/faq.svg"
            alt=""
            width={35}
            height={25}
            aria-hidden="true"
          />
        </button>
      </div>
    </nav>
  );
}
