import { ArrowRight, Clock3, FileSearch, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { StartCaseButton } from "@/features/game/components/start-case-button";

export default function LandingPage() {
  return (
    <main className="home-page" id="top">
      <AppHeader />
      <section className="home-stage" aria-labelledby="home-title">
        <div className="home-copy">
          <h1 id="home-title"><span>审问每个人。</span><span>证据只认事实。</span></h1>
          <p>审问嫌疑人，核对证据，在 12 次提问内提交你的结案判断。</p>
          <div className="home-actions">
            <StartCaseButton />
            <Link href="/cases" className="text-action">浏览案件库 <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
          <dl className="home-conditions" aria-label="游戏规则摘要">
            <div><dt>嫌疑人</dt><dd>3 名</dd></div>
            <div><dt>提问额度</dt><dd>12 次</dd></div>
            <div><dt>最终动作</dt><dd>主动结案</dd></div>
          </dl>
        </div>

        <article className="featured-file" aria-label="当前主案卷">
          <div className="file-binding" aria-hidden="true"><span /><span /><span /></div>
          <header>
            <div><span className="data-label">IR-26-071</span><strong>精修首案</strong></div>
            <span className="file-status">可立即调查</span>
          </header>
          <div className="featured-file__body">
            <span className="redaction-line" aria-hidden="true" />
            <h2>夜班之后，<br />有一份记录不该出现。</h2>
            <p>真相在开局前已经封存。你面对的每一句话，都只能绕开它，不能改写它。</p>
          </div>
          <dl className="file-facts">
            <div><Clock3 aria-hidden="true" /><dt>时长</dt><dd>约 15 分钟</dd></div>
            <div><UsersRound aria-hidden="true" /><dt>对象</dt><dd>三名嫌疑人</dd></div>
            <div><FileSearch aria-hidden="true" /><dt>资料</dt><dd>六份证据</dd></div>
            <div><MapPin aria-hidden="true" /><dt>场景</dt><dd>封闭调查</dd></div>
          </dl>
          <footer><span>固定真相 · 规则判定</span><span>DEEPSEEK 对话</span></footer>
        </article>
      </section>
      <footer className="home-footer"><span>AI 负责人物表达，证据规则决定案件结果。</span><span>桌面端 / 移动端</span></footer>
    </main>
  );
}
