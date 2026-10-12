import { AppHeader } from "@/components/app-header";
import { CaseLibrary } from "@/features/game/components/case-library";

export default function CasesPage() {
  return <main className="cases-page"><AppHeader compact /><CaseLibrary /></main>;
}
