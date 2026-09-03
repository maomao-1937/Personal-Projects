"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoProject } from "../_lib/fixture";
import {
  applyShotEdits as applyShotEditsToProject,
  createTake as createProjectTake,
  retryShot as retryProjectShot,
  selectTake as selectProjectTake,
  type ShotEdits,
} from "../_lib/state";
import type { DemoProject, ShotGenerationDraft } from "../_lib/types";

interface DemoProjectContextValue {
  project: DemoProject;
  applyShotEdits: (shotId: string, edits: ShotEdits) => void;
  createTake: (shotId: string, draft: ShotGenerationDraft) => void;
  retryShot: (shotId: string) => void;
  selectTake: (shotId: string, takeId: string) => void;
}

const DemoProjectContext = createContext<DemoProjectContextValue | null>(null);

interface DemoProjectProviderProps {
  children: ReactNode;
  initialProject?: DemoProject;
}

export function DemoProjectProvider({
  children,
  initialProject = demoProject,
}: DemoProjectProviderProps) {
  const [project, setProject] = useState(initialProject);

  const applyShotEdits = useCallback((shotId: string, edits: ShotEdits) => {
    setProject((current) => applyShotEditsToProject(current, shotId, edits));
  }, []);
  const createTake = useCallback((shotId: string, draft: ShotGenerationDraft) => {
    setProject((current) => createProjectTake(current, shotId, draft));
  }, []);
  const retryShot = useCallback((shotId: string) => {
    setProject((current) => retryProjectShot(current, shotId));
  }, []);
  const selectTake = useCallback((shotId: string, takeId: string) => {
    setProject((current) => selectProjectTake(current, shotId, takeId));
  }, []);

  const value = useMemo(
    () => ({
      project,
      applyShotEdits,
      createTake,
      retryShot,
      selectTake,
    }),
    [applyShotEdits, createTake, project, retryShot, selectTake],
  );

  return <DemoProjectContext.Provider value={value}>{children}</DemoProjectContext.Provider>;
}

export function useDemoProject() {
  const context = useContext(DemoProjectContext);
  if (!context) {
    throw new Error("useDemoProject must be used within DemoProjectProvider");
  }
  return context;
}
