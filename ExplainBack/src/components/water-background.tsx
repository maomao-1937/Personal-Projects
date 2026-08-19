"use client";

import { useEffect, useRef } from "react";

interface Ripple {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  flatness: number;
  tilt: number;
}

const MAX_RIPPLES = 42;

export function WaterBackground({ subdued = false }: { subdued?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) {
      return;
    }

    const motionQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    if (motionQuery?.matches) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let ripples: Ripple[] = [];
    let pointer = { x: 0, y: 0, movedAt: 0, idleRippleAt: 0 };
    let lastWake = { x: 0, y: 0, at: 0 };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const addRipple = (
      x: number,
      y: number,
      power = 0.6,
      wide = false,
    ) => {
      ripples.push({
        x,
        y,
        radius: wide ? 12 : 4,
        alpha: power,
        speed: wide ? 2.05 : 1.35,
        flatness: 0.34 + Math.random() * 0.14,
        tilt: -0.11 + Math.random() * 0.08,
      });
      if (ripples.length > MAX_RIPPLES) {
        ripples = ripples.slice(-MAX_RIPPLES);
      }
    };

    const pointFromEvent = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      const next = pointFromEvent(event);
      const now = performance.now();
      const distance = Math.hypot(next.x - lastWake.x, next.y - lastWake.y);
      pointer = { ...pointer, ...next, movedAt: now };
      root.style.setProperty("--water-x", `${(next.x / width) * 100}%`);
      root.style.setProperty("--water-y", `${(next.y / height) * 100}%`);

      if (distance > 24 || now - lastWake.at > 95) {
        addRipple(next.x, next.y, Math.min(0.68, 0.24 + distance / 150));
        lastWake = { ...next, at: now };
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const next = pointFromEvent(event);
      pointer = { ...pointer, ...next, movedAt: performance.now() };
      addRipple(next.x, next.y, 0.9, true);
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "screen";

      if (
        pointer.movedAt > 0 &&
        now - pointer.movedAt > 420 &&
        now - pointer.movedAt < 2_400 &&
        now - pointer.idleRippleAt > 720
      ) {
        addRipple(pointer.x, pointer.y, 0.38, true);
        pointer.idleRippleAt = now;
      }

      for (const ripple of ripples) {
        for (let ring = 0; ring < 3; ring += 1) {
          const radius = ripple.radius + ring * 9;
          context.beginPath();
          context.ellipse(
            ripple.x,
            ripple.y,
            radius,
            radius * ripple.flatness,
            ripple.tilt,
            0,
            Math.PI * 2,
          );
          context.strokeStyle = `rgba(255,255,255,${ripple.alpha * (0.48 - ring * 0.1)})`;
          context.lineWidth = 1.35;
          context.stroke();

          context.beginPath();
          context.ellipse(
            ripple.x + 1.5,
            ripple.y + 2,
            radius,
            radius * ripple.flatness,
            ripple.tilt,
            0,
            Math.PI * 2,
          );
          context.strokeStyle = `rgba(18,104,132,${ripple.alpha * (0.19 - ring * 0.035)})`;
          context.lineWidth = 0.85;
          context.stroke();
        }
        ripple.radius += ripple.speed;
        ripple.alpha *= 0.972;
      }

      ripples = ripples.filter(
        (ripple) => ripple.alpha > 0.025 && ripple.radius < 210,
      );
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    addRipple(width * 0.72, height * 0.22, 0.34, true);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`water-background${subdued ? " water-background--subdued" : ""}`}
      aria-hidden="true"
      data-testid="water-background"
    >
      <div className="water-depth" />
      <div className="water-caustics" />
      <div className="water-pointer-light" />
      <canvas
        ref={canvasRef}
        className="water-canvas"
        data-testid="water-canvas"
        style={{ pointerEvents: "none" }}
      />
      <div className="water-grain" />
      <svg className="water-filter" focusable="false">
        <filter id="water-distortion" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.025"
            numOctaves="2"
            seed="12"
            result="waterNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="waterNoise"
            scale="38"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
      </svg>
    </div>
  );
}

