"use client";

interface TouchDragProxyProps {
  contactX: number;
  contactY: number;
  proxyX: number;
  proxyY: number;
}

export function TouchDragProxy({ contactX, contactY, proxyX, proxyY }: TouchDragProxyProps) {
  const length = Math.hypot(proxyX - contactX, proxyY - contactY);
  const angle = Math.atan2(proxyY - contactY, proxyX - contactX) * 180 / Math.PI;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
      <span
        className="absolute h-0.5 origin-left bg-white shadow-[0_0_3px_#0f1422] motion-reduce:transition-none"
        style={{ left: contactX, top: contactY, width: length, transform: `rotate(${angle}deg)` }}
      />
      <span
        className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#07b6d3]/50 shadow-[0_0_0_2px_#0f1422]"
        style={{ left: proxyX, top: proxyY }}
      >
        <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 bg-white" />
        <span className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white" />
      </span>
    </div>
  );
}
