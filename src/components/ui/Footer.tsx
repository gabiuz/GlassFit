"use client";
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
  },
  {
    key: "twitter",
    src: "/social_media_icons/Twitter.svg",
    width: 24.35,
    height: 25,
    alt: "Twitter",
  },
  {
    key: "linkedin",
    src: "/social_media_icons/LinkedIn.svg",
    width: 25,
    height: 20.87,
    alt: "LinkedIn",
  },
  {
    key: "youtube",
    src: "/social_media_icons/YouTube.svg",
    width: 25,
    height: 18.06,
    alt: "YouTube",
  },
];

export default function Footer({ className = "" }: FooterProps) {
  return (
    <footer
      className={`w-full bg-white shadow-[inset_0_14px_18px_-12px_rgba(0,0,0,0.25)] ${className}`}
    >
      <div className="mx-auto px-30 py-15">
        <div className="flex flex-col items-center gap-10 md:flex-row md:flex-wrap md:items-start md:justify-center lg:flex-nowrap lg:justify-between">
          <div className="flex flex-col gap-7.75">
            <Image
              src="/glassfit_logo_large.svg"
              alt=""
              width={1454}
              height={618}
              className="w-66.75 h-28"
            ></Image>
            <div className="text-[#3a3a3a] text-lg font-normal leading-7">
              <p className="">Bicutan, Paranaque</p>
              <br />
              <div>
                <p className="">Contact Number: +639 6767 676</p>
                <p className="">Email: glassfit@gmail.com</p>
              </div>
            </div>
            <div className="flex items-end gap-10.5">
              {socialMediaIcons.map((icon) => (
                <Image
                  key={icon.key}
                  src={icon.src}
                  alt={icon.alt}
                  width={icon.width}
                  height={icon.height}
                  className="inline-block mr-4"
                />
              ))}
            </div>
          </div>
          <div>
            <ul className="flex flex-col gap-3.5 text-[#3a3a3a] text-lg font-normal leading-7">
              <li>
                <h3 className="text-lg font-semibold bg-grad-light bg-clip-text text-transparent">
                  Company
                </h3>
              </li>
              <li>About</li>
              <li>Product Catalog</li>
              <li>Visualization Workspace</li>
            </ul>
          </div>
          <div>
            <ul className="flex flex-col gap-3.5 text-[#3a3a3a] text-lg font-normal leading-7">
              <li>
                <h3 className="text-lg font-semibold bg-grad-light bg-clip-text text-transparent">
                  Company
                </h3>
              </li>
              <li>About</li>
              <li>Product Catalog</li>
              <li>Visualization Workspace</li>
              <li>Visualization Workspace</li>
              <li>Visualization Workspace</li>
              <li>Visualization Workspace</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold bg-grad-light bg-clip-text text-transparent">
              View Map
            </h3>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1930.4996121636575!2d121.01031826429568!3d14.599119941974662!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c9dd97a1439b%3A0x44e1b969e7f1f67a!2sPUP%20Main%20-%20A.%20Mabini%20Campus%2C%20Sta.%20Mesa%2C%20Manila!5e0!3m2!1sen!2sph!4v1777809413537!5m2!1sen!2sph"
              width={339}
              height={252}
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map"
            ></iframe>
          </div>
        </div>
      </div>
      <div className="bg-grad-dark text-white flex justify-between items-center px-27.5 py-2.5">
        <p>© 2026 R.R.D Glass and Aluminum. All rights reserved.</p>
        <div className="flex gap-14">
          <p>Privacy Policy</p>
          <p>Terms & Conditions</p>
        </div>
      </div>
    </footer>
  );
}
