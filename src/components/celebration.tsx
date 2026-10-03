"use client";
import { useEffect } from "react";
export function Celebration({ onEnd }: { onEnd: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onEnd, 1300);
    return () => clearTimeout(timer);
  }, [onEnd]);
  return (
    <div className="celebration" aria-hidden="true">
      <div className="celebration-ring" />
      <div className="celebration-check">✓</div>
      {Array.from({ length: 24 }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--angle": `${i * 15}deg`,
              "--distance": `${100 + (i % 4) * 28}px`,
              "--delay": `${(i % 3) * 45}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
