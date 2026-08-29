import { Check } from "lucide-react";

const steps = ["音频", "分析", "故事", "镜头", "预览", "导出"] as const;

export function ProjectProgress() {
  return (
    <nav className="project-progress" aria-label="项目进度">
      <ol>
        {steps.map((step, index) => {
          const complete = index < 3;
          const active = index === 3;
          return (
            <li
              aria-current={active ? "step" : undefined}
              className={active ? "is-active" : complete ? "is-complete" : ""}
              key={step}
            >
              <span className="step-node" aria-hidden="true">
                {complete ? <Check size={14} /> : index + 1}
              </span>
              <span className="step-label">{step}</span>
              {index < steps.length - 1 ? <span className="step-line" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
