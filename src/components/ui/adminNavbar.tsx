import Image from "next/image";

const adminProfile = {
    name: "Jedia Sagun",
    role: "Admin",
    avatarSrc: "/user.svg",
};

export default function AdminNavbar() {
    return (
        <header className="w-full bg-white border-b border-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] px-[87px] py-[19px] z-30 sticky top-0">
            <div className=" flex justify-between items-center w-full">
                <div className="flex items-center">
                    <Image
                        src="/Logo.svg"
                        alt="Glassfit Logo"
                        width={160}
                        height={68}
                        priority
                        className="h-[68px] w-auto object-contain"
                    />
                </div>
                <AdminProfileMenu />
            </div>
        </header>
    );
}

function AdminProfileMenu() {
    return (
        <div className="px-5 py-2.5 bg-neutral-100 rounded-[10px] flex justify-start items-center gap-2.5">
            <div className="size-8 relative bg-cyan-500 rounded-[500px] overflow-hidden">
                <Image
                    src={adminProfile.avatarSrc}
                    alt={adminProfile.name}
                    width={32}
                    height={32}
                    className="object-cover"
                />
            </div>
            <div className="flex flex-col justify-center items-start">
                <p className="text-[#0F1422] text-[16px] font-normal leading-[1.4] tracking-[-0.304px] whitespace-nowrap pointer-events-none">
                    {adminProfile.name}
                </p>
                <p className="text-[#0F1422] text-[12px] font-normal leading-[1.4] tracking-[-0.228px] pointer-events-none">
                    {adminProfile.role}
                </p>
            </div>
            <div className="size-[20px] relative shrink-0 flex items-center justify-center cursor-pointer">
                <Image
                    src="/admin/dropdown-btn.svg"
                    alt="Toggle Menu"
                    width={15}
                    height={15}
                />
            </div>
        </div>
    );
}

