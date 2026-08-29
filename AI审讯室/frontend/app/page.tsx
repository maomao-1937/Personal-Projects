import { AccessMenu } from "@/features/auth/access-menu";
import { CinematicCaseLaunch } from "@/features/game/components/cinematic-case-launch";

export default function LandingPage() {
  return (
    <main className="landing-page" id="top">
      <header className="landing-nav">
        <a href="#top" className="wordmark" aria-label="AI 审讯室首页">
          <span>AI</span> 审讯室
        </a>
        <AccessMenu />
      </header>
      <CinematicCaseLaunch />
    </main>
  );
}
