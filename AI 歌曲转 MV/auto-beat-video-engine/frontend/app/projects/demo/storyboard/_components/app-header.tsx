import { ArrowLeft, Check, ChevronDown, Clapperboard, Wifi } from "lucide-react";

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="brand-cluster">
        <span className="brand-mark" aria-hidden="true">
          <Clapperboard size={22} strokeWidth={2.2} />
        </span>
        <strong className="brand-name">声画</strong>
        <span className="header-divider" aria-hidden="true" />
        <button className="header-link" type="button">
          <ArrowLeft aria-hidden="true" size={18} />
          <span>返回项目</span>
        </button>
      </div>

      <div className="project-title">
        <strong>霁虹之后</strong>
        <span className="saved-state">
          <Check aria-hidden="true" size={14} />
          已保存
        </span>
      </div>

      <div className="header-status">
        <span className="preview-data-badge">UI 预览数据</span>
        <span className="connection-state">
          <Wifi aria-hidden="true" size={15} />
          本地预览
        </span>
        <button className="avatar-button" aria-label="打开用户菜单" type="button">
          <span aria-hidden="true">SG</span>
          <ChevronDown aria-hidden="true" size={15} />
        </button>
      </div>
    </header>
  );
}
