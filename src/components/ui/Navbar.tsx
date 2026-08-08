"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as motion from "motion/react-client";
import Button from "@/components/shared/Button";
import { useAuth } from "@/features/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Product Catalog", href: "/product" },
  { label: "Visualization Workspace", href: "/visualization" },
];

type ClassNameProps = {
  className?: string;
};

export default function Navbar({ className = "" }: ClassNameProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push("/");
    router.refresh();
    setIsSigningOut(false);
  };

  const displayName = user
    ? (user.user_metadata?.first_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Account"
    : null;

  const authSection = isLoading ? (
    <div className="hidden lg:flex items-center gap-3 shrink-0">
      <div className="h-9 w-20 rounded-[10px] bg-[#c3c3c3]/30 animate-pulse" />
      <div className="h-9 w-28 rounded-[10px] bg-[#c3c3c3]/30 animate-pulse" />
    </div>
  ) : user ? (
    <div className="hidden lg:flex items-center gap-3 xl:gap-4 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-green/10 border border-green/30">
        <div className="w-7 h-7 rounded-full bg-green flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold uppercase">
            {displayName?.[0] ?? "U"}
          </span>
        </div>
        <span className="text-sm font-medium text-green whitespace-nowrap max-w-[120px] truncate">
          {displayName}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="flex items-center justify-center px-3 xl:px-5 py-2.5 rounded-[10px] bg-black text-white text-sm font-normal whitespace-nowrap hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
      >
        {isSigningOut ? "Signing out..." : "Log Out"}
      </button>
    </div>
  ) : (
    <div className="hidden lg:flex items-center gap-3 xl:gap-5 2xl:gap-6.25 shrink-0">
      <Link href="/login">
        <Button
          value="Log In"
          leftIcon={null}
          rightIcon={null}
          variant="blackBtnWhiteText"
          className="px-3! xl:px-5! py-2.5! rounded-[10px]! whitespace-nowrap"
        />
      </Link>
      <Link href="/register">
        <Button
          value="Sign Up"
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
          className="px-3! xl:px-5! py-2.5! rounded-[10px]! whitespace-nowrap"
        />
      </Link>
    </div>
  );

  return (
    <nav
      className={`z-100 w-full lg:w-11/12 fixed left-0 right-0 mx-auto bg-white/75 border-b lg:border border-green rounded-none lg:rounded-[30px] px-4 py-3 lg:px-6 xl:px-12 2xl:px-18.75 lg:py-5 flex justify-between items-center gap-2 lg:gap-4 xl:gap-6 shadow-[-5px_4px_30px_0px_rgba(4,94,109,0.30)] transition-all duration-300 ${
        isScrolled ? "top-0 lg:top-2 shadow-md bg-white/90" : "top-0 lg:top-21.5"
      } ${className}`}
    >
      {/* Logo */}
      <div className="navbar-logo shrink-0">
        <Link href="/" aria-label="GlassFit home">
          <Image
            src="/Logo.svg"
            alt="GlassFit"
            width={120}
            height={120}
            aria-hidden="true"
            className="w-[120px] h-auto lg:w-[140px] xl:w-[160px] 2xl:w-[181px]"
          />
        </Link>
      </div>

      {/* Desktop Links */}
      <div className="navbar-links hidden lg:flex min-w-0 gap-4 xl:gap-8 2xl:gap-15">
        {navLinks.map(({ label, href }) => {
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
                href={href}
                className={`text-base xl:text-lg leading-4 whitespace-nowrap navbar-link flex hover:text-green ${
                  isActive ? "text-green font-bold" : ""
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
              <motion.span
                className="pointer-events-none absolute left-1/2 -bottom-1 h-0.5 -translate-x-1/2 rounded-full"
                variants={{
                  rest: { width: "12px", backgroundColor: "var(--color-black)" },
                  hover: { width: "100%", backgroundColor: "var(--color-green)" },
                  active: { width: "100%", backgroundColor: "var(--color-green)" },
                }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </motion.span>
          );
        })}
      </div>

      {/* Desktop Auth Section */}
      {authSection}

      {/* Mobile Hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden p-2 text-black hover:text-green focus:outline-none"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
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

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-green rounded-[20px] p-6 flex flex-col gap-6 shadow-lg lg:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setIsOpen(false)}
                className="text-lg text-black hover:text-green py-1"
              >
                {label}
              </Link>
            ))}
          </div>
          <hr className="border-[#c3c3c3]" />
          {!isLoading && (
            <div className="flex flex-col gap-3">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-[10px] bg-green/10 border border-green/30">
                    <div className="w-8 h-8 rounded-full bg-green flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-semibold uppercase">
                        {displayName?.[0] ?? "U"}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-green truncate">
                        {displayName}
                      </span>
                      <span className="text-xs text-[#c3c3c3] truncate">{user.email}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full flex items-center justify-center py-2.5 px-5 rounded-[10px] bg-black text-white text-sm font-normal hover:bg-neutral-800 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {isSigningOut ? "Signing out..." : "Log Out"}
                  </button>
                </>
              ) : (
                <>
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
                      value="Sign Up"
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
                </>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
