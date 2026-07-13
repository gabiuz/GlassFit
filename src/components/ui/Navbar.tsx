"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as motion from "motion/react-client";
import Button from "@/components/shared/Button";

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav
      className={`z-100 w-full lg:w-11/12 fixed top-0 lg:top-21.5 left-0 right-0 mx-auto bg-white/75 border-b lg:border border-green rounded-none lg:rounded-[30px] px-4 py-3 lg:px-6 xl:px-12 2xl:px-18.75 lg:py-5 flex justify-between items-center gap-2 lg:gap-4 xl:gap-6 shadow-[-5px_4px_30px_0px_rgba(4,94,109,0.30)] ${className}`}
    >
      <div className="navbar-logo shrink-0">
        <button className="navbar-icon" aria-label="Menu">
          <Image
            src="/Logo.svg"
            alt=""
            width={120}
            height={51}
            aria-hidden="true"
            className="w-[120px] h-auto lg:w-[140px] xl:w-[160px] 2xl:w-[181px]"
          />
        </button>
      </div>

      {/* Desktop Links */}
      <div className="navbar-links hidden lg:flex min-w-0 gap-4 xl:gap-8 2xl:gap-15">
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
              className="relative inline-flex items-center shrink-0"
              onMouseEnter={() => setHoveredLabel(label)}
              onMouseLeave={() => setHoveredLabel(null)}
            >
              <Link
                href="#"
                className={`text-base xl:text-lg leading-4 whitespace-nowrap navbar-link flex hover:text-green ${isActive ? "text-green font-bold" : ""}`}
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

      {/* Desktop Auth Buttons */}
      <div className="hidden lg:flex items-center gap-3 xl:gap-5 2xl:gap-6.25 shrink-0">
        <Link href="/login">
          <Button
            value="Log In"
            leftIcon={null}
            rightIcon={null}
            variant="blackBtnWhiteText"
            className="px-3! xl:px-5! py-2.5! rounded-[10px]! whitespace-nowrap"
          ></Button>
        </Link>
        <Link href="/register">
          <Button
            value="Sign In"
            leftIcon={
              <Image
                src="/navbar_icons/user.svg"
                alt="user icon"
                width={27}
                height={27}
              ></Image>
            }
            rightIcon={null}
            variant="greenBtnWhiteText"
            className="px-3! xl:px-5! py-2.5! rounded-[10px]! whitespace-nowrap"
          ></Button>
        </Link>
      </div>

      {/* Mobile Hamburger Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 text-black hover:text-green focus:outline-none"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-green rounded-[20px] p-6 flex flex-col gap-6 shadow-lg lg:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((label) => (
              <Link
                key={label}
                href="#"
                onClick={() => setIsOpen(false)}
                className="text-lg text-black hover:text-green py-1"
              >
                {label}
              </Link>
            ))}
          </div>
          <hr className="border-[#c3c3c3]" />
          <div className="flex flex-col gap-3">
            <Link href="/login" onClick={() => setIsOpen(false)}>
              <Button
                value="Log In"
                leftIcon={null}
                rightIcon={null}
                variant="blackBtnWhiteText"
                className="w-full justify-center px-5! py-2.5! rounded-[10px]!"
              />
            </Link>
            <Link href="/register" onClick={() => setIsOpen(false)}>
              <Button
                value="Sign In"
                leftIcon={
                  <Image
                    src="/navbar_icons/user.svg"
                    alt="user icon"
                    width={27}
                    height={27}
                  />
                }
                rightIcon={null}
                variant="greenBtnWhiteText"
                className="w-full justify-center px-5! py-2.5! rounded-[10px]!"
              />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

