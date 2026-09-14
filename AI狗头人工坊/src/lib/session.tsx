import {
  createContext,
  useEffect,
  useContext,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  buildPrompt,
  configSchema,
  publicProfile,
  type ModelProfile,
  type Breed,
} from "../../shared/models";
import type { GenerationResult } from "../../server/adapters";
import { breeds, getBreed, type Style } from "../../shared/breeds";
import {
  directorSchema,
  type DirectorConfig,
  type AgentEvent,
  type DesignPlan,
  type ImageReview,
  type AgentHistory,
} from "../../shared/agent";

import { listProjects, saveProject, type Project } from "./projects";

export type Portrait = { src: string; name: string; isExample: boolean };
export type Run = {
  id: string;
  group: string;
  projectId?: string;
  parentId?: string;
  originalPortrait?: Portrait;
  request?: string;
  plan?: DesignPlan;
  history?: AgentHistory;
  trace?: Exclude<AgentEvent, { type: 'result' }>[];
  settings?: { customBreed: string; style: Style; freedom: 'head' | 'scene' };
  profile: ModelProfile;
  prompt: string;
  breed: Breed;
  portrait: Portrait;
  startedAt: string;
  status: "loading" | "success" | "error";
  result?: GenerationResult;
  error?: string;
  origin?: "agent";
  breedLabel?: string;
  review?: ImageReview;
};
function loadProfiles() {
  try {
    const stored = configSchema.parse(
      JSON.parse(localStorage.getItem("goutou.models.v1") || "{}"),
    );
    return stored.models.map(publicProfile);
  } catch {
    return [];
  }
}
function useSessionState() {
  const [projectId, setProjectId] = useState<string>(() => crypto.randomUUID());
  const [projects, setProjects] = useState<Project[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [compareSource, setCompareSource] = useState<Run | null>(null);
  const [profiles, setProfiles] = useState<ModelProfile[]>(loadProfiles);
  const [managed, setManaged] = useState<{ models: ModelProfile[]; director: DirectorConfig | null; defaultModel: string; adminMode: string; promptWriter?: { model: string } | null }>({ models: [], director: null, defaultModel: '', adminMode: 'disabled' });
  const [connectionError, setConnectionError] = useState('');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [breed, setBreed] = useState<Breed>("shiba");
  const [extra, setExtra] = useState("");
  const [customBreed, setCustomBreed] = useState("");
  const [style, setStyle] = useState<Style>("photo");
  const [freedom, setFreedom] = useState<"head" | "scene">("head");
  const [director, setDirector] = useState<DirectorConfig | null>(() => {
    try {
      return directorSchema.parse(
        JSON.parse(localStorage.getItem("goutou.director.v2") || "null"),
      );
    } catch {
      return null;
    }
  });
  const [directorKey, setDirectorKey] = useState("");
  const [agentMode, setAgentMode] = useState(true);
  const [delegateBreed, setDelegateBreed] = useState(false);
  const [maxRenders, setMaxRenders] = useState<1 | 2>(1);
  const [agentPlan, setAgentPlan] = useState<DesignPlan | null>(null);
  const [agentNote, setAgentNote] = useState("");
  const [agentQuestion, setAgentQuestion] = useState(false);
  const [agentChoices, setAgentChoices] = useState<string[]>([]);
  const [agentHistory, setAgentHistory] = useState<AgentHistory>([]);
  const [agentStatus, setAgentStatus] = useState<{
    stage: string;
    message: string;
  } | null>(null);
  const [agentTrace, setAgentTrace] = useState<AgentEvent[]>([]);
  const [selected, setSelected] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [studioRun, setStudioRun] = useState<string | null>(null);
  const [compareGroup, setCompareGroup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [samplePreview, setSamplePreview] = useState(true);
  const activeRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputTicket = useRef(0);
  const prompt = buildPrompt(breed, extra, { customBreed, style, freedom });
  function managedProfile(id: string) {
    const p = profiles.find(p => p.id === id);
    return managed.models.some(m => m.id === id && m.endpoint === p?.endpoint && m.model === p?.model && m.provider === p?.provider);
  }
  const canSaveKey = (id: string) => !!keys[id] || managed.models.some(m => {
    const p = profiles.find(p => p.id === id); return m.id === id && m.endpoint === p?.endpoint && m.provider === p?.provider;
  });
  const hasKey = (id: string) => !!keys[id] || managedProfile(id);
  const hasDirectorKey = !!directorKey || (!!managed.director && JSON.stringify(director) === JSON.stringify(managed.director));
  async function loadConnections() {
    try {
      const response = await fetch('/api/connections'); if (!response.ok) throw new Error();
      const data = await response.json();
      const models = configSchema.parse({ version: 1, models: data.models }).models;
      const config = data.director ? directorSchema.parse(data.director) : null;
      setManaged({ models, director: config, defaultModel: data.defaultModel, adminMode: data.adminMode, promptWriter: data.promptWriter || null });
      setProfiles(prev => [...models, ...prev.filter(p => !models.some(m => m.id === p.id))]);
      if (config) setDirector(config);
      if (data.defaultModel) setSelected(data.defaultModel);
      setConnectionError('');
    } catch { setConnectionError('无法读取站点连接，请检查本地服务后重试。'); }
  }
  useEffect(() => { void loadConnections(); }, []);
  async function saveConnections(adminToken: string) {
    const response = await fetch('/api/connections', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-studio-admin': adminToken },
      body: JSON.stringify({ models: profiles.map(p => ({ profile: publicProfile(p), key: keys[p.id] || '' })), director: director ? { config: director, key: directorKey } : null, defaultModel: selected || profiles[0]?.id || '' }),
    });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '保存失败');
    await loadConnections();
  }
  const currentRun = runs.find(r => r.id === studioRun && r.result);
  const currentProject = (): Project => ({
    id: projectId, title: portrait?.name.replace(/\.[^.]+$/, '') || '新创作', updatedAt: new Date().toISOString(),
    compareSourceId: compareSource?.id || null, compareGroup,
    portrait, runs, studioRun, breed, customBreed, extra, style, freedom, agentMode, delegateBreed, agentPlan, agentHistory,
  });
  function restoreProject(p: Project) {
    if (activeRef.current) return;
    setProjectId(p.id); setPortrait(p.portrait); setRuns(p.runs); setStudioRun(p.studioRun);
    setBreed(p.breed); setCustomBreed(p.customBreed); setExtra(p.extra); setStyle(p.style);
    setFreedom(p.freedom); setAgentMode(p.agentMode); setDelegateBreed(p.delegateBreed);
    setAgentPlan(p.agentPlan); setAgentHistory(p.agentHistory);
    setSamplePreview(!p.portrait); setAgentQuestion(false); setAgentChoices([]); setAgentNote(''); setAgentTrace([]); setCompareSource(p.runs.find(r => r.id === p.compareSourceId) || null); setCompareGroup(p.compareGroup || null);
  }
  async function persistProject(p = currentProject()) {
    try { await saveProject(p); setProjects(await listProjects()); setSaveError(''); }
    catch { setSaveError('浏览器未能保存项目，请先下载作品；当前页面仍可继续使用。'); }
  }
  useEffect(() => {
    let live = true;
    listProjects().then(items => { if (live) { setProjects(items); if (items[0]) restoreProject(items[0]); } })
      .catch(() => { if (live) setSaveError('浏览器暂不支持项目保存，本次作品请及时下载。'); })
      .finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => void persistProject(), 300);
    return () => clearTimeout(timer);
  }, [hydrated, projectId, portrait, runs, studioRun, compareSource, compareGroup, breed, customBreed, extra, style, freedom, agentMode, delegateBreed, agentPlan, agentHistory]);
  function newProject() {
    if (activeRef.current || preparing) return;
    void persistProject(); setProjectId(crypto.randomUUID()); setRuns([]); setExtra('');
    replacePortrait(null, false); setCompareSource(null); setCompareGroup(null);
  }
  function selectVersion(id: string | null) {
    if (activeRef.current) return;
    const r = runs.find(r => r.id === id && r.result);
    setStudioRun(r?.id || null); setSamplePreview(false); setExtra('');
    setAgentPlan(r?.plan || null); setAgentHistory(r?.history || []);
    if (r) {
      setBreed(r.breed); setCustomBreed(r.settings?.customBreed || (r.breed === 'custom' ? r.breedLabel || '' : ''));
      if (r.settings) { setStyle(r.settings.style); setFreedom(r.settings.freedom); }
    }
    setAgentNote(''); setAgentQuestion(false); setAgentChoices([]); setAgentTrace(r?.trace || []);
  }
  function saveDirector(config: DirectorConfig, key: string) {
    const safe = directorSchema.parse(config);
    setDirector(safe);
    setDirectorKey(key);
    try {
      localStorage.setItem("goutou.director.v2", JSON.stringify(safe));
    } catch {
      toast.error("浏览器无法保存配置，本次会话仍可使用。");
    }
  }
  function removeDirector() {
    setDirector(null);
    setDirectorKey("");
    try {
      localStorage.removeItem("goutou.director.v2");
    } catch {
      /* session removed */
    }
  }
  function persist(next: ModelProfile[]) {
    const safe = next.map(publicProfile);
    setProfiles(safe);
    try {
      localStorage.setItem(
        "goutou.models.v1",
        JSON.stringify({ version: 1, models: safe }),
      );
    } catch {
      toast.error("浏览器无法保存配置，本次会话仍可使用。");
    }
  }
  function saveProfile(profile: ModelProfile, key: string) {
    persist(
      profiles.some((p) => p.id === profile.id)
        ? profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...profiles, profile],
    );
    setKeys((prev) => ({ ...prev, [profile.id]: key }));
    if (!selected) setSelected(profile.id);
  }
  function removeProfile(id: string) {
    persist(profiles.filter((p) => p.id !== id));
    setKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selected === id) setSelected("");
  }
  function replacePortrait(next: Portrait | null, archive = true) {
    if (activeRef.current) return;
    if (archive && portrait) { void persistProject(); setProjectId(crypto.randomUUID()); setRuns([]); }
    if (portrait) setExtra(''); setCompareSource(null); setCompareGroup(null);
    inputTicket.current++;
    setAgentHistory([]);
    setAgentChoices([]);
    setAgentPlan(null);
    setAgentNote("");
    setAgentQuestion(false);
    setAgentTrace([]);
    setPortrait(next);
    setStudioRun(null);
    setSamplePreview(!next);
  }
  async function useExample() {
    if (activeRef.current || preparing) return;
    setPreparing(true);
    const ticket = ++inputTicket.current;
    try {
      const response = await fetch("/images/example-person.png");
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (ticket !== inputTicket.current) return;
      replacePortrait({ src, name: "示例人像.png", isExample: true });
      toast.success("示例人像已准备好");
    } catch {
      toast.error("示例图片暂时无法读取，请重试或上传自己的照片。");
    } finally {
      setPreparing(false);
    }
  }
  async function executeRun(run: Run, controller: AbortController) {
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          profile: {
            provider: run.profile.provider,
            model: run.profile.model,
            endpoint: run.profile.endpoint,
          },
          apiKey: keys[run.profile.id],
          connectionId: !keys[run.profile.id] && managedProfile(run.profile.id) ? run.profile.id : undefined,
          image: run.portrait.src,
          prompt: run.prompt,
        }),
      });
      const body = await response
        .json()
        .catch(() => ({ error: "服务返回异常，请检查服务端是否已启动。" }));
      if (!response.ok || !body.image)
        throw new Error(body.error || "没有收到可用图片，请重试。");
      setRuns((prev) =>
        prev.map((r) =>
          r.id === run.id
            ? { ...r, status: "success", result: body as GenerationResult }
            : r,
        ),
      );
      if (run.group !== compareGroup && run.projectId === projectId && run.request !== undefined) { setStudioRun(run.id); setExtra(""); }
      return true;
    } catch (error) {
      const message = controller.signal.aborted
        ? "已停止等待。供应商可能仍在处理，本次调用可能计费。"
        : error instanceof Error
          ? error.message
          : "生成失败，请重试。";
      setRuns((prev) =>
        prev.map((r) =>
          r.id === run.id ? { ...r, status: "error", error: message } : r,
        ),
      );
    }
  }
  async function retryRun(run: Run) {
    const currentProfile = profiles.find((p) => p.id === run.profile.id);
    if (activeRef.current || !currentProfile || !hasKey(currentProfile.id))
      return;
    activeRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const retry: Run = {
      ...run,
      review: undefined,
      trace: undefined,
      origin: undefined,
      profile: publicProfile(currentProfile),
      startedAt: new Date().toISOString(),
      status: "loading",
      result: undefined,
      error: undefined,
    };
    setRuns((prev) => prev.map((r) => (r.id === run.id ? retry : r)));
    await executeRun(retry, controller);
    activeRef.current = false;
    setBusy(false);
    abortRef.current = null;
  }
  async function startRuns(chosen: ModelProfile[], mode: "studio" | "compare") {
    if (
      activeRef.current ||
      preparing ||
      !portrait ||
      !chosen.length ||
      chosen.some((p) => !hasKey(p.id))
    )
      return;
    activeRef.current = true;
    setBusy(true);
    setSamplePreview(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const group = crypto.randomUUID();
    const source = mode === 'compare' ? compareSource : currentRun;
    const inputPortrait = mode === 'compare' ? (source?.portrait || { ...portrait }) : currentRun?.result ? { ...portrait, src: currentRun.result.image, name: '选中的狗头作品' } : { ...portrait };
    const actualPrompt = mode === 'compare' && source ? source.prompt : currentRun?.result
      ? `编辑输入的狗头人作品。${extra.trim() || '保持当前造型，生成一个新的自然变体。'}。目标犬种：${getBreed(breed)?.label || customBreed}。画面质感：${style === 'photo' ? '自然摄影' : style === 'paint' ? '绘画' : '3D角色'}。未明确要求修改的表情、配饰保持不变。${freedom === 'head' ? '保留人类身体、手部、姿势、服装、背景和构图，仅调整头部及必要融合。' : '仅按明确要求调整场景，其余身体和构图保持不变。'}`
      : prompt;
    const fresh: Run[] = chosen.map((profile) => ({
      id: crypto.randomUUID(),
      group,
      projectId, parentId: mode === 'studio' ? currentRun?.id : source?.parentId,
      originalPortrait: { ...portrait },
      ...(mode === 'studio' ? { request: extra.trim() || `生成${getBreed(breed)?.label || customBreed}狗头人` } : {}),
      profile: publicProfile(profile),
      prompt: actualPrompt,
      breed: mode === 'compare' && source ? source.breed : breed,
      breedLabel: mode === 'compare' && source ? source.breedLabel : breed === "custom" ? customBreed : getBreed(breed)?.label,
      settings: mode === 'compare' && source ? source.settings : { customBreed, style, freedom },
      portrait: inputPortrait,
      startedAt: new Date().toISOString(),
      status: "loading",
    }));
    setRuns((prev) => [...fresh, ...prev]);
    if (mode === "studio") {
      setAgentHistory([]);
      setAgentChoices([]);
      setAgentStatus({ stage: "generate", message: "正在生成狗头人" });
      setAgentTrace([]);
      setAgentNote("");
      setAgentQuestion(false);
      setAgentPlan(null);
    } else setCompareGroup(group);
    await Promise.allSettled(fresh.map((run) => executeRun(run, controller)));
    setAgentStatus(null);
    activeRef.current = false;
    setBusy(false);
    abortRef.current = null;
  }
  async function startAgent(chosen: ModelProfile, reply?: string) {
    const draft = (reply ?? extra).trim();
    if (agentQuestion && !draft) return;
    const request = draft || (agentHistory.length > 0 ? "保持上一轮造型要求，再生成一张。" : "请根据照片和选择的犬种，设计自然、有趣的犬系分身。");
    if (
      activeRef.current ||
      preparing ||
      !portrait ||
      !director ||
      !hasDirectorKey ||
      !hasKey(chosen.id)
    )
      return;
    activeRef.current = true;
    if (reply !== undefined) setExtra(reply);
    setBusy(true);
    setSamplePreview(false);
    setAgentNote("");
    setAgentQuestion(false);
    setAgentChoices([]);
    setAgentTrace([]);
    const controller = new AbortController();
    abortRef.current = controller;
    const group = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const baseline = currentRun?.result ? { ...portrait, src: currentRun.result.image, name: "选中的狗头作品" } : { ...portrait };
    let currentPlan = agentPlan;
    let gotDone = false;
    let turnQuestion: string | undefined;
    let hadError = false;
    const runIds = new Map<number, string>();
    let turnTrace: Exclude<AgentEvent, { type: 'result' }>[] = [];
    const accept = (event: AgentEvent) => {
      if (event.type !== "result") {
        turnTrace = [...turnTrace, event];
        setAgentTrace(turnTrace);
        const snapshot = turnTrace;
        setRuns(prev => prev.map(r => r.group === group ? { ...r, trace: snapshot } : r));
      }
      if (event.type === "status") setAgentStatus(event);
      if (event.type === "plan") {
        currentPlan = event.plan;
        setAgentPlan(event.plan);
      }
      if (event.type === "message") {
        setAgentNote(event.message);
        setAgentQuestion(!!event.question);
        setAgentChoices(event.question ? event.choices || [] : []);
        if (event.question) turnQuestion = event.message;
      }
      if (event.type === "error") {
        hadError = true;
        setAgentNote(event.message);
        toast.error(event.message);
      }
      if (event.type === "done") {
        gotDone = true;
        if (!hadError) {
          setAgentHistory([...agentHistory, { request, ...(turnQuestion ? { question: turnQuestion } : {}) }].slice(-6));
          if (event.reason !== "limit") setExtra("");
        }
      }
      if (event.type === "result") {
        const id = crypto.randomUUID();
        runIds.set(event.iteration, id);
        const plannedBreed = currentPlan?.breed || (breed === 'custom' ? customBreed : getBreed(breed)?.label || '');
        const resolvedBreed = breeds.find(b => b.label === plannedBreed)?.id || 'custom';
        const run: Run = {
          id,
          group,
          projectId, parentId: currentRun?.id, originalPortrait: { ...portrait },
          request, plan: currentPlan || undefined, history: [...agentHistory, { request }].slice(-6),
          profile: publicProfile(chosen),
          prompt: event.prompt,
          breed: resolvedBreed,
          breedLabel: plannedBreed,
          settings: { customBreed: resolvedBreed === 'custom' ? plannedBreed : '', style, freedom },
          portrait: baseline,
          startedAt,
          status: "success",
          result: event.result,
          origin: "agent",
          trace: turnTrace,
        };
        setRuns((prev) => [run, ...prev]);
        setStudioRun(id);
        setBreed(resolvedBreed); setCustomBreed(run.settings!.customBreed);
      }
      if (event.type === "review") {
        const id = runIds.get(event.iteration);
        setRuns((prev) =>
          prev.map((r) => (r.id === id ? { ...r, review: event.review } : r)),
        );
      }
    };
    try {
      setAgentStatus({ stage: "understand", message: "正在连接创作助手" });
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          director,
          directorKey,
          useSavedDirector: !directorKey && hasDirectorKey,
          connectionId: !keys[chosen.id] && managedProfile(chosen.id) ? chosen.id : undefined,
          renderer: {
            provider: chosen.provider,
            model: chosen.model,
            endpoint: chosen.endpoint,
          },
          rendererKey: keys[chosen.id],
          image: baseline.src,
          task: currentRun?.result ? "edit" : "create",
          request,
          history: agentHistory,
          preferredBreed: delegateBreed
            ? ""
            : breed === "custom"
              ? customBreed
              : getBreed(breed)?.label || "",
          style,
          freedom,
          maxRenders,
          previousPlan: agentPlan || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Agent 暂时无法响应，请稍后重试。");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("浏览器无法读取生成状态，请重试。");
      const decoder = new TextDecoder();
      let pending = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          if (pending.length > 48_000_000)
            throw new Error("返回内容过大，请降低输出尺寸。");
          let newline;
          while ((newline = pending.indexOf("\n")) >= 0) {
            const line = pending.slice(0, newline);
            pending = pending.slice(newline + 1);
            if (line.trim()) accept(JSON.parse(line) as AgentEvent);
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!gotDone)
        setAgentNote(
          (prev) => prev || "连接已结束，已有作品已保留；本轮未完整执行。",
        );
    } catch (error) {
      const message = controller.signal.aborted
        ? "已停止等待。已生成的版本会保留；供应商可能仍在处理或计费。"
        : error instanceof Error
          ? error.message
          : "Agent 执行中断，请重试。";
      setAgentNote(message);
      if (reply !== undefined) setExtra(reply);
      if (agentQuestion && !turnQuestion) {
        setAgentQuestion(true);
        setAgentChoices(agentChoices);
        setAgentNote(`${agentNote}\n${message}`);
      }
    } finally {
      activeRef.current = false;
      setBusy(false);
      setAgentStatus(null);
      abortRef.current = null;
    }
  }
  return {
    managed, managedProfile, hasKey, canSaveKey, hasDirectorKey, saveConnections, loadConnections, connectionError,
    projectId, projects, hydrated, saveError, newProject,
    openProject: async (id: string) => { if (activeRef.current || preparing) return; await persistProject(); const p = projects.find(p => p.id === id); if (p) restoreProject(p); },
    compareSource, setCompareSource: (source: Run | null) => { setCompareSource(source); setCompareGroup(null); },
    profiles,
    keys,
    portrait,
    breed,
    setBreed,
    extra,
    setExtra,
    selected,
    setSelected,
    prompt,
    runs,
    busy,
    preparing,
    setPreparing,
    studioRun,
    compareGroup,
    samplePreview,
    customBreed,
    setCustomBreed,
    style,
    setStyle,
    freedom,
    setFreedom,
    director,
    directorKey,
    saveDirector,
    removeDirector,
    agentMode,
    setAgentMode,
    delegateBreed,
    setDelegateBreed,
    maxRenders,
    setMaxRenders,
    agentPlan,
    agentNote,
    agentQuestion,
    agentChoices,
    agentHistory,
    agentStatus,
    agentTrace,
    startAgent,
    selectVersion,
    saveProfile,
    removeProfile,
    persist,
    replacePortrait,
    useExample,
    startRuns,
    cancel: () => abortRef.current?.abort(),
    retryRun,
    showExample: () => {
      setStudioRun(null);
      setSamplePreview(true);
    },
  };
}
const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(
  null,
);
export function SessionProvider({ children }: { children: ReactNode }) {
  const state = useSessionState();
  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
