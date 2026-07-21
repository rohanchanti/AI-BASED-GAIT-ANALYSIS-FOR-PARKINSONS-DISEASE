import { useMemo } from "react";

/** Pure-CSS animated starfield + nebula halo. Sits behind everything. */
export function Starfield() {
  const stars = useMemo(() => {
    const rand = mulberry32(1337);
    return Array.from({ length: 90 }, () => ({
      top: rand() * 100,
      left: rand() * 100,
      size: rand() * 2 + 0.6,
      delay: rand() * 5,
      duration: 3 + rand() * 5,
      opacity: 0.4 + rand() * 0.6,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Nebula glows */}
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-purple/25 blur-[120px] pulse-slow" />
      <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-primary/25 blur-[120px] pulse-slow" style={{ animationDelay: "1.5s" }} />
      <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-cyan/20 blur-[120px] pulse-slow" style={{ animationDelay: "2.8s" }} />

      {/* Stars */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white twinkle"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            boxShadow: "0 0 6px rgba(255,255,255,0.8)",
          }}
        />
      ))}

      {/* Shooting stars */}
      <span
        className="absolute top-[15%] left-[-100px] h-[2px] w-[120px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent shooting-star"
        style={{ animationDelay: "1s" }}
      />
      <span
        className="absolute top-[55%] left-[-100px] h-[2px] w-[100px] rounded-full bg-gradient-to-r from-transparent via-cyan to-transparent shooting-star"
        style={{ animationDelay: "4s" }}
      />
    </div>
  );
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
