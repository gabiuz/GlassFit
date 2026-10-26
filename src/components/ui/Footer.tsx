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
      <div className="mx-auto px-6 py-10 md:px-10 md:py-12 lg:px-12 lg:py-15 xl:px-30">
        <div className="flex flex-col items-center gap-10 md:flex-row md:flex-wrap md:items-start md:justify-between xl:flex-nowrap text-center md:text-left">
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
            <div className="flex flex-col gap-4 text-[#3a3a3a] text-lg font-normal leading-7">
              <p>Bicutan, Parañaque</p>
              <div>
                <p className="">Contact Number: 0918-601-4737</p>
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
              <li><Link href="/product" className="hover:text-green transition-colors">Product Catalog</Link></li>
              <li><Link href="/visualization" className="hover:text-green transition-colors">Visualization Workspace</Link></li>
            </ul>
          </div>
          <div className="flex w-full flex-col items-center md:w-auto lg:items-start">
            <h3 className="text-lg font-semibold bg-grad-light bg-clip-text text-transparent mb-3.5">
              View Map
            </h3>
            <iframe
              src="https://www.google.com/maps?q=Bicutan%2C%20Para%C3%B1aque&output=embed"
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
      <div className="bg-grad-dark text-white flex flex-col lg:flex-row gap-4 justify-between items-center px-6 md:px-10 lg:px-27.5 py-4 lg:py-2.5 text-center text-sm lg:text-base">
        <p>© 2026 R.R.D Glass and Aluminum. All rights reserved.</p>
        <div className="flex gap-6 md:gap-8 lg:gap-14">
          <Link href="/privacy" className="hover:underline cursor-pointer">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline cursor-pointer">Terms &amp; Conditions</Link>
        </div>
      </div>
    </footer>
  );
}
