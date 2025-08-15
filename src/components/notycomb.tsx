"use client";

import Image from "next/image";

export default function YCButtonLight() {
  return (
    <div className="flex justify-center mb-8">
      <div
        className="relative w-fit h-fit flex flex-row items-center px-2 sm:px-3 lg:px-[12px] py-1 sm:py-1.5 lg:py-[6px] rounded-[15px] sm:rounded-[20px] lg:rounded-[25px] transition-all duration-300 hover:scale-105 cursor-pointer group overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgb(245, 245, 245) 0%, rgb(255, 255, 255) 50%, rgb(240, 240, 240) 100%)",
          boxShadow:
            "rgba(0, 0, 0, 0.05) 0px 4px 16px, rgba(0, 0, 0, 0.06) 0px 1px 0px inset",
          border: "1px solid rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Soft highlight glow */}
        <div
          className="absolute pointer-events-none transition-all duration-1000 ease-out"
          style={{
            left: "-22px",
            top: "-16px",
            width: "80px",
            height: "80px",
            background:
              "radial-gradient(circle, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.03) 30%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(8px)",
            opacity: 1,
            zIndex: 1,
          }}
        ></div>

        {/* Hover overlay */}
        <div
          className="absolute inset-0 rounded-[15px] sm:rounded-[20px] lg:rounded-[25px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0.05) 100%)",
            filter: "blur(2px)",
            zIndex: -1,
          }}
        ></div>

        {/* Content */}
        <div className="relative w-fit h-fit flex flex-row items-center gap-1.5 sm:gap-2 lg:gap-[8px] z-20">
          <span
            className="text-[10px] sm:text-[11px] lg:text-[12px] font-medium tracking-wide"
            style={{
              color: "rgb(50, 50, 50)",
              opacity: 0.85,
              textShadow: "rgba(255, 255, 255, 0.6) 0px 1px 2px",
            }}
          >
            Not Backed by
          </span>
          <div className="relative">
            <Image
              alt="Y Combinator Logo"
              width={16}
              height={16}
              className="w-3 h-3 sm:w-4 sm:h-4 lg:w-4 lg:h-4 rounded-[2px] sm:rounded-[3px] transition-transform duration-300 group-hover:scale-110"
              src="/yc-small.svg"
              style={{
                filter: "drop-shadow(rgba(255, 255, 255, 0.6) 0px 1px 2px)",
              }}
            />
          </div>
          <span
            className="text-[10px] sm:text-[11px] lg:text-[12px] font-medium tracking-wide"
            style={{
              color: "rgb(50, 50, 50)",
              opacity: 0.85,
              textShadow: "rgba(255, 255, 255, 0.6) 0px 1px 2px",
            }}
          >
            Combinator
          </span>
        </div>

        {/* Animated background */}
        <div
          className="absolute inset-0 rounded-[15px] sm:rounded-[20px] lg:rounded-[25px] animate-pulse opacity-10"
          style={{
            background:
              "linear-gradient(135deg, rgb(255, 255, 255) 0%, rgb(240, 240, 240) 100%)",
            animation: "3s ease-in-out infinite prestigePulse",
            zIndex: -2,
          }}
        ></div>
      </div>
    </div>
  );
}
