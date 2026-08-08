"use client";
import Link from "next/link";
import Image from "next/image";

type FooterProps = {
  className?: string;
};

const socialMediaIcons = [
  {
    key: "facebook",
    src: "/social_media_icons/Facebook.svg",
    width: 14.62,
    height: 25,
    alt: "Facebook",
    href: "#",
  },
  {
    key: "twitter",
    src: "/social_media_icons/Twitter.svg",
    width: 24.35,
    height: 25,
    alt: "Twitter",
    href: "#",
  },
  {
    key: "linkedin",
    src: "/social_media_icons/LinkedIn.svg",
    width: 25,
    height: 20.87,
    alt: "LinkedIn",
    href: "#",
  },
  {
    key: "youtube",
    src: "/social_media_icons/YouTube.svg",
    width: 25,
    height: 18.06,
    alt: "YouTube",
    href: "#",
  },
];

export default function Footer({ className = "" }: FooterProps) {
  return (
    <footer
      className={`w-full bg-white shadow-[inset_0_14px_18px_-12px_rgba(0,0,0,0.25)] ${className}`}
    >
      <div className="mx-auto px-6 py-10 md:px-10 md:py-12 lg:px-30 lg:py-15">
        <div className="flex flex-col items-center gap-10 md:flex-row md:flex-wrap md:items-start md:justify-between lg:flex-nowrap lg:justify-between text-center md:text-left">
          <div className="flex flex-col items-center md:items-start gap-7.75">
            <Link href="/">
              <Image
                src="/glassfit_logo_large.svg"
                alt=""
                width={1454}
                height={618}
                className="w-48 h-20 md:w-66.75 md:h-28"
              />
            </Link>
            <div className="text-[#3a3a3a] text-lg font-normal leading-7">
              <p className="hidden md:block">Bicutan, Paranaque</p>
              <br className="hidden md:block" />
              <div>
                <p className="">Contact Number: +639 6767 676</p>
                <p className="">Email: glassfit@gmail.com</p>
              </div>
            </div>
            <div className="flex items-end gap-6 md:gap-10.5 justify-center md:justify-start">
              {socialMediaIcons.map((icon) => (
                <a
                  key={icon.key}
                  href={icon.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={icon.alt}
                  className="inline-block mr-0 md:mr-4"
                >
                  <Image
                    src={icon.src}
                    alt={icon.alt}
                    width={icon.width}
                    height={icon.height}
                  />
                </a>
              ))}
            </div>
          </div>
          <div>
            <ul className="flex flex-col gap-3.5 text-[#3a3a3a] text-lg font-normal leading-7 items-center md:items-start">
              <li>
                <h3 className="text-lg font-semibold bg-grad-light bg-clip-text text-transparent">
                  Company
                </h3>
              </li>
              <li><Link href="/#about" className="hover:text-green transition-colors">About</Link></li>
              <li><Link href="/product" className="hover:text-green transition-colors">Product Catalog</Link></li>
              <li><Link href="/visualization" className="hover:text-green transition-colors">Visualization Workspace</Link></li>
            </ul>
          </div>
          <div className="flex flex-col items-center md:hidden lg:items-start lg:block w-full md:w-auto">
            <h3 className="text-lg font-semibold bg-grad-light bg-clip-text text-transparent mb-3.5">
              View Map
            </h3>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1930.4996121636575!2d121.01031826429568!3d14.599119941974662!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c9dd97a1439b%3A0x44e1b969e7f1f67a!2sPUP%20Main%20-%20A.%20Mabini%20Campus%2C%20Sta.%20Mesa%2C%20Manila!5e0!3m2!1sen!2sph!4v1777809413537!5m2!1sen!2sph"
              className="w-full max-w-[339px] h-[252px] border-0"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map"
            ></iframe>
          </div>
        </div>
      </div>
      <div className="bg-grad-dark text-white flex flex-col md:flex-row gap-4 justify-between items-center px-6 md:px-10 lg:px-27.5 py-4 md:py-2.5 text-center text-sm lg:text-base">
        <p>© 2026 R.R.D Glass and Aluminum. All rights reserved.</p>
        <div className="flex gap-6 md:gap-8 lg:gap-14">
          <Link href="/privacy" className="hover:underline cursor-pointer">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline cursor-pointer">Terms &amp; Conditions</Link>
        </div>
      </div>
    </footer>
  );
}
