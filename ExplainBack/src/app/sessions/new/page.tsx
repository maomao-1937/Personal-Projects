import { SessionForm } from "@/components/session-form";

export default function NewSessionPage() {
  return (
    <main className="page-wrap" id="main-content">
      <header className="page-intro">
        <span className="eyebrow">New learning session</span>
        <h1>今天想把什么讲明白？</h1>
        <p>
          输入一个想讲明白的主题；如有资料，也可以一并粘贴。
        </p>
      </header>
      <SessionForm />
    </main>
  );
}
