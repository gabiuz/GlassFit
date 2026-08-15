import Image from "next/image";

const adminProfile = {
    name: "Jedia Sagun",
    role: "Admin",
    avatarSrc: "/user.svg",
};

export default function AdminNavbar() {
    return (
        <div className="px-24 py-5 bg-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] outline outline-1 outline-offset-[-1px] outline-white flex justify-between items-start overflow-hidden">
            <div className="flex justify-start items-center gap-5">
                <Image src="/Logo.svg" alt="Logo" width={160} height={68} />
            </div>
            <AdminProfileMenu />
        </div>
    );
}

function AdminProfileMenu() {
    return (
        <div className="px-5 py-2.5 bg-neutral-100 rounded-[10px] flex justify-start items-center gap-2.5">
            <div className="size-8 relative bg-cyan-500 rounded-[500px] overflow-hidden">
                <Image
                    src={adminProfile.avatarSrc}
                    alt="Logo"
                    width={32}
                    height={32}
                />
            </div>
            <div className="inline-flex flex-col justify-center items-start">
                <p className="text-black text-lg lg:text-base font-normal leading-6">
                    {adminProfile.name}
                </p>
                <div className="text-center justify-start text-gray-900 text-xs font-normal leading-4">
                    {adminProfile.role}
                </div>
            </div>
            <div className="size-5 relative overflow-hidden mt-5">
                <Image src="/admin/dropdown-btn.svg" alt="Toggle" width={15} height={15} />
            </div>
        </div>
    );
}
