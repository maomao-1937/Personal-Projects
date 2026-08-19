"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type FieldErrors = Partial<Record<"title" | "sourceText", string>>;

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
    resourceId?: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export function SessionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const clientRequestId = useRef<string | null>(null);

  const resetRequestId = () => {
    clientRequestId.current = null;
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const cleanTitle = title.trim();
    const cleanSource = sourceText.trim();
    if (cleanTitle.length < 2) errors.title = "主题至少需要 2 个字符";
    else if (cleanTitle.length > 80) errors.title = "主题不能超过 80 个字符";
    if (cleanSource.length > 0 && cleanSource.length < 100)
      errors.sourceText = "学习资料请留空，或至少输入 100 个字符";
    else if (cleanSource.length > 60_000)
      errors.sourceText = "学习资料不能超过 60,000 个字符";
    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    clientRequestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: clientRequestId.current,
          title: title.trim(),
          sourceText: sourceText.trim(),
        }),
      });
      const payload = (await response.json()) as ErrorPayload & {
        data?: { id: string };
      };

      if (!response.ok) {
        if (payload.error?.fieldErrors) {
          setFieldErrors({
            title: payload.error.fieldErrors.title?.[0],
            sourceText: payload.error.fieldErrors.sourceText?.[0],
          });
        }
        if (payload.error?.resourceId && payload.error.code?.startsWith("AI_")) {
          router.push(`/sessions/${payload.error.resourceId}`);
          return;
        }
        setFormError(payload.error?.message ?? "创建失败，请稍后重试");
        return;
      }

      if (!payload.data?.id) {
        setFormError("服务返回内容不完整，请稍后重试");
        return;
      }
      router.push(`/sessions/${payload.data.id}`);
    } catch {
      setFormError("网络连接失败，你填写的内容仍保留在页面中");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="session-form glass-card" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <div className="form-label-row">
          <label htmlFor="session-title">学习主题</label>
          <span>{title.length} / 80</span>
        </div>
        <input
          id="session-title"
          name="title"
          value={title}
          onChange={(event) => {
            resetRequestId();
            setTitle(event.target.value);
          }}
          placeholder="例如：RAG 为什么能补充模型知识"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "title-error" : undefined}
          disabled={submitting}
        />
        {fieldErrors.title ? (
          <p className="field-error" id="title-error">
            {fieldErrors.title}
          </p>
        ) : null}
      </div>

      <div className="form-field">
        <div className="form-label-row">
          <label htmlFor="source-text">学习资料（可选）</label>
          <span>{sourceText.length.toLocaleString("zh-CN")} / 60,000</span>
        </div>
        <textarea
          id="source-text"
          name="sourceText"
          value={sourceText}
          onChange={(event) => {
            resetRequestId();
            setSourceText(event.target.value);
          }}
          placeholder="可粘贴正文或 Markdown；留空则根据学习主题直接训练。"
          aria-invalid={Boolean(fieldErrors.sourceText)}
          aria-describedby={fieldErrors.sourceText ? "source-error" : "source-help"}
          disabled={submitting}
        />
        {fieldErrors.sourceText ? (
          <p className="field-error" id="source-error">
            {fieldErrors.sourceText}
          </p>
        ) : (
          <p className="field-help" id="source-help">
            留空：依据通用知识；填写：至少 100 字，并严格依据资料。
          </p>
        )}
      </div>

      {formError ? (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      ) : null}

      <div className="form-submit-row">
        <p>系统会根据主题或资料生成 1～10 个可训练知识点。</p>
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? "正在拆解知识点…" : "生成学习地图"}
        </button>
      </div>
    </form>
  );
}
