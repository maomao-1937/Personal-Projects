"use client";

import { gsap } from "gsap";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";

import aiSuspectAsset from "@/public/images/case-launch/ai-suspect.png";
import interrogatorAsset from "@/public/images/case-launch/interrogator.png";

import { type CaseLaunchCompletion, useCaseLaunch } from "../use-case-launch";

const PROMPT = "用 8 次提问，审讯一个会撒谎、却无法改写真相的 AI 嫌疑人。";
const CAGE_BARS = Array.from({ length: 7 }, (_, index) => index);

export type CinematicCaseLaunchProps = {
  onComplete?: (completion: CaseLaunchCompletion) => void | Promise<void>;
};

export function CinematicCaseLaunch({ onComplete }: CinematicCaseLaunchProps = {}) {
  const launch = useCaseLaunch({
    introDurationMs: 4_000,
    lockedDurationMs: 500,
    onComplete,
  });
  const scopeRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const rearLightRef = useRef<HTMLDivElement>(null);
  const blackoutRef = useRef<HTMLDivElement>(null);
  const cageRef = useRef<HTMLDivElement>(null);
  const latchRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const suspectRef = useRef<HTMLDivElement>(null);
  const interrogatorRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const ceremonyPlayedRef = useRef(false);

  useLayoutEffect(() => {
    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (launch.lifecycleState !== "CEREMONY" || ceremonyPlayedRef.current) return;
    ceremonyPlayedRef.current = true;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    gsap.context(() => {
      if (reduceMotion) {
        gsap.set(copyRef.current, { autoAlpha: 0 });
        gsap.set(rearLightRef.current, { autoAlpha: 0 });
        gsap.set(blackoutRef.current, { autoAlpha: 0 });
        gsap.set(cageRef.current, { autoAlpha: 1, y: 0, yPercent: 0 });
        gsap.set(latchRef.current, { autoAlpha: 1, y: 0 });
        gsap.set(spotlightRef.current, { autoAlpha: 1 });
        gsap.set(suspectRef.current, { autoAlpha: 0.85 });
        return;
      }

      // Absolute positions keep this visual timeline independent from network
      // and React render timing.
      const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
      timelineRef.current = timeline;

      timeline
        // 0.00–0.25: immediate tactile response and copy exit.
        .to(copyRef.current, {
          autoAlpha: 0,
          y: 8,
          filter: "blur(5px)",
          duration: 0.22,
          ease: "power2.out",
        }, 0)
        // 0.25–1.25: three uneven loss-of-power pulses.
        .to(rearLightRef.current, { opacity: 0.12, duration: 0.09, ease: "none" }, 0.25)
        .to(rearLightRef.current, { opacity: 0.86, duration: 0.08, ease: "none" }, 0.37)
        .to(rearLightRef.current, { opacity: 0.08, duration: 0.11, ease: "none" }, 0.50)
        .to(rearLightRef.current, { opacity: 0.68, duration: 0.07, ease: "none" }, 0.66)
        .to(rearLightRef.current, { opacity: 0.05, duration: 0.12, ease: "none" }, 0.78)
        .to(rearLightRef.current, { opacity: 0.46, duration: 0.06, ease: "none" }, 0.96)
        .to(rearLightRef.current, { opacity: 0, duration: 0.18, ease: "power1.in" }, 1.07)
        // 1.25–1.55: a true 300ms blackout before the mechanism moves.
        .set(blackoutRef.current, { autoAlpha: 1 }, 1.25)
        .set(suspectRef.current, { autoAlpha: 0 }, 1.25)
        .to(interrogatorRef.current, { opacity: 0.24, duration: 0.2 }, 1.25)
        .to(blackoutRef.current, { autoAlpha: 0, duration: 0.08, ease: "none" }, 1.55)
        // 1.55–2.75: gravity-biased cage drop.
        .fromTo(cageRef.current, {
          autoAlpha: 1,
          yPercent: -145,
        }, {
          autoAlpha: 1,
          yPercent: 0,
          duration: 1.2,
          ease: "power3.in",
        }, 1.55)
        // 2.75–3.15: 3px → 2px → 1px mechanical rebound and latch closure.
        .to(cageRef.current, { y: -3, duration: 0.07, ease: "power2.out" }, 2.75)
        .to(cageRef.current, { y: 2, duration: 0.07, ease: "power2.in" }, 2.82)
        .to(cageRef.current, { y: -1, duration: 0.06, ease: "none" }, 2.89)
        .to(cageRef.current, { y: 0, duration: 0.06, ease: "none" }, 2.95)
        .fromTo(latchRef.current, {
          autoAlpha: 0,
          y: -12,
        }, {
          autoAlpha: 1,
          y: 0,
          duration: 0.18,
          ease: "back.out(2.4)",
        }, 2.97)
        // 3.15–3.65: 3000K tungsten light energises in layered bloom.
        .to(spotlightRef.current, {
          autoAlpha: 1,
          duration: 0.5,
          ease: "power2.out",
        }, 3.15)
        // 3.65–4.00: human silhouette and AI reconstruction resolve together.
        .to(suspectRef.current, {
          autoAlpha: 0.85,
          duration: 0.35,
          ease: "power1.out",
        }, 3.65);
    }, scopeRef);
  }, [launch.lifecycleState]);

  const isGenerating = launch.lifecycleState === "GENERATING";
  const isLocking = launch.lifecycleState === "LOCKING" || launch.lifecycleState === "COMPLETED";

  return (
    <section
      ref={scopeRef}
      className={`cinematic-launch cinematic-launch--${launch.lifecycleState.toLowerCase()}`}
      data-launch-state={launch.lifecycleState}
      aria-label="AI 嫌疑人案件生成场景"
      aria-busy={launch.busy}
    >
      <div className="cinematic-stage" aria-hidden="true">
        <div className="cinematic-stage__wall" />
        <div className="cinematic-stage__floor" />
        <div ref={rearLightRef} className="rear-light">
          <span className="rear-light__fixture" />
          <span className="rear-light__beam" />
          <span className="rear-light__pool" />
        </div>

        <div ref={spotlightRef} className="overhead-light">
          <span className="overhead-light__fixture" />
          <span className="overhead-light__beam" />
          <span className="overhead-light__pool" />
        </div>

        <div ref={suspectRef} className="suspect-seat">
          <Image className="suspect-seat__asset" src={aiSuspectAsset} alt="" width={1024} height={1536} priority />
          <span className="ai-reconstruction ai-reconstruction--head" />
          <span className="ai-reconstruction ai-reconstruction--torso" />
          <span className="ai-scanlines" />
          <span className="ai-noise" />
          <span className="ai-node ai-node--one" />
          <span className="ai-node ai-node--two" />
          <span className="ai-node ai-node--three" />
        </div>

        <div ref={interrogatorRef} className="interrogator-silhouette">
          <Image className="interrogator-silhouette__asset" src={interrogatorAsset} alt="" width={1024} height={1536} priority />
        </div>

        <div ref={cageRef} className="containment-frame">
          <div className="containment-frame__depth" />
          <div className="containment-frame__roof" />
          <div className="containment-frame__bars">
            {CAGE_BARS.map((bar) => <span key={bar} />)}
          </div>
          <span className="containment-frame__crossbar containment-frame__crossbar--top" />
          <span className="containment-frame__crossbar containment-frame__crossbar--middle" />
          <span className="containment-frame__crossbar containment-frame__crossbar--bottom" />
          <span className="containment-frame__foot containment-frame__foot--left" />
          <span className="containment-frame__foot containment-frame__foot--right" />
          <div ref={latchRef} className="containment-frame__lock">
            <span className="containment-frame__shackle" />
            <i />
          </div>
        </div>

        <div className="cinematic-stage__dust">
          {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
        </div>
        <div className="cinematic-stage__vignette" />
        <div className="cinematic-stage__grain" />
        <div ref={blackoutRef} className="cinematic-stage__blackout" />
      </div>

      <div ref={copyRef} className="cinematic-copy">
        <p className="cinematic-copy__line" aria-label={PROMPT}>
          用 8 次提问，审讯一个<span className="cinematic-copy__shift">会撒谎</span>、却
          <span className="cinematic-copy__truth">无法改写真相</span>的
          <span className="cinematic-copy__shift">AI 嫌疑人</span>。
        </p>
        <button className="cinematic-launch__button" type="button" onClick={() => void launch.startGenerated()} disabled={launch.busy}>
          <span>生成案件</span>
          <i aria-hidden="true">开始</i>
        </button>
      </div>

      <div className="cinematic-feedback">
        {isGenerating ? (
          <p className="cinematic-feedback__status" role="status"><span aria-hidden="true" />{launch.phaseText}</p>
        ) : null}
        {isLocking ? (
          <div className="cinematic-feedback__locked" role="status"><strong>TRUTH LOCKED</strong><span>真相已封存</span></div>
        ) : null}
        {launch.lifecycleState === "ERROR" && launch.error ? (
          <div className="cinematic-feedback__error" role="alert">
            <p>{launch.error}</p>
            <button type="button" onClick={() => void launch.startFallback()}>改用精修固定案继续体验</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
