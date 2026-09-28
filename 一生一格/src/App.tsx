import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Crosshair, House, LogIn, LogOut, NotebookPen, RotateCcw, Settings2, X } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import LifeAtlas from './components/LifeAtlas';
import MindCockpit from './components/MindCockpit';
import TimelineControls from './components/TimelineControls';
import { createLifeCalendarToDate, type LifeWeek } from './lib/lifeCalendar';
import { downloadCalendarSvg } from './lib/exportSvg';
import { anniversary, clearLocalProfile, readLocalProfile, validIsoDate, writeLocalProfile, type EndMode, type MindGuide, type MindRole, type MindSelection } from './lib/profileStorage';
import { clearAccountDraft, clearLegacyAccountDraft, findLegacyAccountDraft, readAccountDraft, skipLocalImport, skippedLocalImport } from './lib/accountDraft';
import { getRemoteProfile, getSession, logout, putRemoteProfile, type AccountUser, type RemoteProfile } from './lib/cloudApi';
import { useAccountSync } from './lib/useAccountSync';
import type { ProfileData } from './lib/profileStorage';

const DEMO_BIRTH_DATE = '1995-04-17';
const DEFAULT_TARGET_AGE = 90;
const DEMO_END_DATE = '2085-04-17';

function nextDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function formatNumber(number: number) { return new Intl.NumberFormat('zh-CN').format(number); }

function ageOnDate(birthDate: string, date: string) {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const anniversaryDay = birthMonth === 2 && birthDay === 29 && !isLeapYear ? 28 : birthDay;
  return Math.max(0, year - birthYear - (month < birthMonth || (month === birthMonth && day < anniversaryDay) ? 1 : 0));
}

function weekNoteKey(birthDate: string, week: LifeWeek) { return `${birthDate}:${week.startDate}`; }

function weekDescription(week: LifeWeek) {
  const phase = week.status === 'past' ? '已走过' : week.status === 'current' ? '正在经历' : '尚未到来';
  return `第 ${week.index + 1} 周，${week.age} 岁，${formatDate(week.startDate)}至${formatDate(week.endDate)}，${phase}`;
}

type GridProps = {
  row: LifeWeek[];
  selectedIndex: number;
  notes: Record<string, string>;
  birthDate: string;
  onSelect: (index: number) => void;
};

function WeekGrid({ row, selectedIndex, notes, birthDate, onSelect }: GridProps) {
  function moveByKeyboard(event: KeyboardEvent<HTMLButtonElement>, week: LifeWeek) {
    let target: LifeWeek | undefined;
    switch (event.key) {
      case 'ArrowLeft': target = row[week.weekOfAge - 2]; break;
      case 'ArrowRight': target = row[week.weekOfAge]; break;
      case 'ArrowUp': target = row[week.weekOfAge - 9]; break;
      case 'ArrowDown': target = row[week.weekOfAge + 7]; break;
      case 'Home': target = row[0]; break;
      case 'End': target = row.at(-1); break;
      default: return;
    }
    event.preventDefault();
    if (!target) return;
    onSelect(target.index);
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.week-square[data-week-index="${target.index}"]`)?.focus());
  }

  return (
    <div className="week-grid" role="group" aria-label={`${row[0]?.age ?? 0} 岁的 ${row.length} 个周格；使用方向键移动焦点`}>
      {row.map((week) => {
        const hasNote = Boolean(notes[weekNoteKey(birthDate, week)]);
        return <button key={week.index} type="button"
          className={`week-square ${week.status} ${selectedIndex === week.index ? 'selected' : ''} ${hasNote ? 'has-note' : ''}`}
          aria-label={`${weekDescription(week)}${hasNote ? '，有记录' : ''}`}
          aria-pressed={selectedIndex === week.index}
          tabIndex={selectedIndex === week.index || (selectedIndex < row[0].index || selectedIndex > row.at(-1)!.index) && week.weekOfAge === 1 ? 0 : -1}
          data-week-index={week.index} title={weekDescription(week)}
          onClick={() => onSelect(week.index)} onKeyDown={(event) => moveByKeyboard(event, week)} />;
      })}
    </div>
  );
}

type CalendarProps = {
  mode: 'preview' | 'account';
  account?: AccountUser;
  initialProfile?: ProfileData | null;
  initialRevision?: number;
  forceSyncInitial?: boolean;
  onLogout?: () => Promise<void>;
  onBackToLogin?: () => void;
  onUseRemote?: (remote: RemoteProfile) => void;
};

function CalendarApp({ mode, account, initialProfile = null, initialRevision = 0, forceSyncInitial = false, onLogout, onBackToLogin, onUseRemote }: CalendarProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const initial = useMemo(() => mode === 'account' ? initialProfile : null, []);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? DEMO_BIRTH_DATE);
  const [endDate, setEndDate] = useState(initial?.endDate ?? DEMO_END_DATE);
  const [endMode, setEndMode] = useState<EndMode>(initial?.endMode ?? 'age');
  const [targetAge, setTargetAge] = useState(() => Math.max(1, Math.min(120, ageOnDate(initial?.birthDate ?? DEMO_BIRTH_DATE, initial?.endDate ?? DEMO_END_DATE))));
  const [isDemo, setIsDemo] = useState(!initial);
  const [notes, setNotes] = useState<Record<string, string>>(initial?.notes ?? {});
  const [mind, setMind] = useState<MindSelection>(initial?.mind?.day === today ? initial.mind : { selected: 'rational', day: today });
  const [guide, setGuide] = useState<MindGuide>({ goal: initial?.guide.goal ?? '', distraction: initial?.guide.distraction ?? '', soundEnabled: initial?.guide.soundEnabled !== false });
  const [guideDraftSaved, setGuideDraftSaved] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>(initial ? 'saved' : 'idle');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focusedAge, setFocusedAge] = useState(0);
  const [toast, setToast] = useState('');
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [pendingBirthDate, setPendingBirthDate] = useState<string | null>(null);
  const [birthEditReset, setBirthEditReset] = useState(0);
  const birthInputRef = useRef<HTMLInputElement>(null);
  const actualAge = ageOnDate(birthDate, today);
  const calendar = useMemo(() => createLifeCalendarToDate(birthDate, endDate), [birthDate, endDate]);
  const defaultWeekIndex = calendar.currentIndex >= 0 ? calendar.currentIndex : calendar.pastCount === calendar.totalCount ? calendar.totalCount - 1 : 0;
  const selectedWeek = calendar.weeks[selectedIndex] ?? calendar.weeks[defaultWeekIndex];
  const currentWeek = calendar.weeks[calendar.currentIndex];
  const effectiveSelectedIndex = selectedWeek?.index ?? -1;
  const noteKey = selectedWeek ? weekNoteKey(birthDate, selectedWeek) : '';
  const selectedNote = notes[noteKey] ?? '';
  const defaultFocusAge = calendar.weeks[defaultWeekIndex]?.age ?? 0;
  const displayedAge = Math.max(0, Math.min(calendar.rows.length - 1, focusedAge));
  const progress = calendar.totalCount ? (calendar.pastCount / calendar.totalCount) * 100 : 0;
  const sync = useAccountSync(account?.id ?? null, initialProfile, initialRevision, forceSyncInitial,
    { birthDate, endDate, endMode, notes, mind, guide }, mode === 'account' && !isDemo);
  const accountStatus = isDemo ? '账号已登录 · 设置生日后开始记录'
    : sync.status === 'synced' ? '已同步到账号'
      : sync.status === 'syncing' ? '正在同步…'
        : sync.status === 'conflict' ? '需要处理同步冲突'
          : sync.status === 'error' ? '同步失败 · 本机草稿已保留' : '本机待同步';

  useEffect(() => setFocusedAge(defaultFocusAge), [birthDate, endDate, defaultFocusAge]);
  useEffect(() => {
    if (mode === 'account') return;
    if (isDemo) {
      setSaveStatus('idle');
      setGuideDraftSaved(true);
      return;
    }
    setSaveStatus(writeLocalProfile({ birthDate, endDate, endMode, notes, mind, guide }) ? 'saved' : 'error');
  }, [birthDate, endDate, endMode, notes, mind, guide, isDemo, mode]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function applyBirthDate(next: string) {
    if (!validIsoDate(next) || next > today) return;
    setBirthDate(next);
    if (endMode === 'age') {
      setEndDate(anniversary(next, targetAge));
    } else if (endDate <= next || endDate > anniversary(next, 120)) {
      setTargetAge(DEFAULT_TARGET_AGE);
      setEndMode('age');
      setEndDate(anniversary(next, DEFAULT_TARGET_AGE));
    } else {
      setTargetAge(Math.max(1, Math.min(120, ageOnDate(next, endDate))));
    }
    setSelectedIndex(-1);
    setIsDemo(false);
    setToast('出生日期已更新');
  }

  function updateBirthDate(next: string) {
    if (next === birthDate) return;
    const oldRecordCount = Object.entries(notes).filter(([key, value]) => key.startsWith(`${birthDate}:`) && value.trim()).length;
    if (oldRecordCount > 0) setPendingBirthDate(next);
    else applyBirthDate(next);
  }

  function updateEndDate(next: string) {
    if (!validIsoDate(next)) return;
    if (next <= birthDate || next > anniversary(birthDate, 120)) {
      setToast('终点日期需在出生日期之后，且不超过 120 年');
      return;
    }
    setEndDate(next);
    setTargetAge(Math.max(1, Math.min(120, ageOnDate(birthDate, next))));
    setEndMode('date');
    setSelectedIndex(-1);
    setIsDemo(false);
    setToast('终点日期已更新');
  }

  function updateTargetAge(next: number) {
    if (!Number.isInteger(next) || next < 1 || next > 120) return;
    setTargetAge(next);
    setEndDate(anniversary(birthDate, next));
    setEndMode('age');
    setSelectedIndex(-1);
    setIsDemo(false);
  }

  function updateEndMode(next: EndMode) {
    if (next === endMode) return;
    setEndMode(next);
    if (next === 'age') {
      setEndDate(anniversary(birthDate, targetAge));
      setSelectedIndex(-1);
      setIsDemo(false);
    }
  }

  function selectAge(age: number, jump = false) {
    const safeAge = Math.max(0, Math.min(calendar.rows.length - 1, age));
    setFocusedAge(safeAge);
    setSelectedIndex(calendar.rows[safeAge][0].index);
    if (jump) window.setTimeout(() => document.getElementById('week-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  function selectWeek(index: number) {
    const week = calendar.weeks[index];
    if (!week) return;
    setSelectedIndex(index);
    setFocusedAge(week.age);
  }

  function goToCurrentWeek() {
    selectWeek(defaultWeekIndex);
    window.setTimeout(() => document.querySelector(window.matchMedia('(max-width: 700px)').matches ? '.detail-panel' : '#week-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  function openTimelineSettings() {
    setMobileSettingsOpen(true);
    window.setTimeout(() => document.getElementById('timeline-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    window.setTimeout(() => birthInputRef.current?.focus(), 330);
  }

  function selectMind(role: MindRole) {
    setMind({ selected: role, day: today });
  }

  function resetDemo() {
    if (!window.confirm('这会清除保存在这台设备上的出生日期和所有周记录，确定恢复示例吗？')) return;
    if (!clearLocalProfile()) {
      setSaveStatus('error');
      setToast('本机数据清除失败，请检查浏览器存储设置');
      return;
    }
    setBirthDate(DEMO_BIRTH_DATE);
    setEndDate(DEMO_END_DATE);
    setEndMode('age');
    setTargetAge(DEFAULT_TARGET_AGE);
    setNotes({});
    setMind({ selected: 'rational', day: today });
    setGuide({ goal: '', distraction: '', soundEnabled: true });
    setSelectedIndex(-1);
    setIsDemo(true);
    setToast('已恢复示例视图');
  }

  return <div className="page-shell">
    <a className="skip-link" href="#week-explorer">跳到每周详情</a>
    <header className="topbar">
      <a className="brand-lockup" href="#top" aria-label="一生一格，返回顶部"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><span className="brand">一生一格</span></a>
      <div className="top-controls">
        {mode === 'account' ? <button className="account-button" type="button" title="退出账号" aria-label="退出账号" onClick={() => { if (sync.status !== 'synced' && !isDemo && !window.confirm('还有内容尚未同步。退出后本机草稿会保留，重新登录可继续同步。确定退出吗？')) return; void onLogout?.().catch(() => setToast('退出失败，请联网后重试')); }}><LogOut size={17} aria-hidden="true"/><span>退出</span></button>
          : <button className="account-button" type="button" onClick={onBackToLogin}><LogIn size={17} aria-hidden="true"/><span>登录</span></button>}
        <button className="settings-button" type="button" aria-label="打开时间设置" aria-controls="timeline-settings" aria-expanded={mobileSettingsOpen} onClick={() => mobileSettingsOpen ? setMobileSettingsOpen(false) : openTimelineSettings()}><Settings2 size={18} aria-hidden="true"/><span>设置</span></button>
        <button className="export-button" type="button" onClick={() => { downloadCalendarSvg(calendar, birthDate, endDate); setToast('周历图片已导出'); }}><ArrowDownToLine size={17} aria-hidden="true"/>导出图片</button>
      </div>
    </header>

    <main id="top">
      <section className="intro" aria-labelledby="main-title">
        <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line"/> LIFE IN WEEKS · 人生周历</div><h1 id="main-title"><span className="desktop-title">把一生，看成一周一周<span>。</span></span><span className="mobile-title">这一周，正在发生。</span></h1><p>每一格，都是实实在在的七天。找到此刻，也看看时间的全貌。</p></div>
        <div className="intro-now"><span className={`now-label${saveStatus === 'error' || sync.status === 'error' ? ' now-label--error' : ''}`} role="status"><i/> {mode === 'account' ? accountStatus : isDemo ? '示例视图 · 设置生日后开始记录' : saveStatus === 'error' ? '本机保存失败' : '已保存到本机'}</span><strong>{calendar.currentIndex >= 0 ? formatNumber(calendar.currentIndex + 1) : '—'}</strong><span className="now-caption">{calendar.currentIndex >= 0 ? `正在经历的这一周 · ${actualAge} 岁` : '当前已超过所选终点日期'}</span>{currentWeek && <span className="now-date">{formatDate(currentWeek.startDate)} — {formatDate(currentWeek.endDate)}</span>}<button type="button" aria-label={isDemo ? '设置生日，开始记录' : undefined} onClick={isDemo ? openTimelineSettings : goToCurrentWeek}><span className="desktop-title">{isDemo ? '设置生日，开始记录' : calendar.currentIndex >= 0 ? '定位这一周' : '查看最后一周'}</span><span className="mobile-title">{isDemo ? '设置生日，开始记录' : '查看本周记录'}</span> <ArrowRight size={15} aria-hidden="true"/></button></div>
      </section>

      <div className={`timeline-settings${mobileSettingsOpen ? ' timeline-settings--open' : ''}`} id="timeline-settings"><button className="settings-close" type="button" onClick={() => setMobileSettingsOpen(false)} aria-label="关闭时间设置"><X size={18} aria-hidden="true"/>完成</button><TimelineControls key={birthEditReset} birthDate={birthDate} endDate={endDate} endMode={endMode} targetAge={targetAge}
        totalWeeks={calendar.totalCount} today={today} minEndDate={nextDay(birthDate)} maxEndDate={anniversary(birthDate, 120)}
        birthInputRef={birthInputRef} onBirthChange={updateBirthDate} onEndDateChange={updateEndDate}
        onAgeChange={updateTargetAge} onModeChange={updateEndMode}/></div>

      <section className="stat-strip" aria-label="周数概览">
        <div className="stat-intro"><span>{isDemo ? '示例日历' : '我的人生周历'}</span><strong>从出生到终点</strong><small>{formatDate(birthDate)} — {formatDate(endDate)}</small></div>
        <div className="stat"><strong>{formatNumber(calendar.pastCount)}</strong><span>已走过的周</span></div>
        <div className="stat"><strong>{formatNumber(calendar.futureCount)}</strong><span>尚未到来的周</span></div>
        <div className="stat stat-progress"><strong>{progress.toFixed(1)}<em>%</em></strong><span>展示范围已走过</span></div>
      </section>

      <div className="primary-workspace">
        <div className="side-stack">
        <MindCockpit selected={mind.selected} onSelect={selectMind} guide={guide} onGuideChange={setGuide} guideDraftSaved={guideDraftSaved}/>
        <aside className="detail-panel" id="week-note" aria-label="选中的一周">
          <div className="detail-topline"><span className="detail-kicker"><i/> 本周记录</span><span className={`status-pill ${selectedWeek?.status ?? 'future'}`}>{selectedWeek?.status === 'current' ? '这一周' : selectedWeek?.status === 'past' ? '已走过' : '未到来'}</span></div>
          {selectedWeek && <>
            <div className="detail-title-row"><div><span className="detail-overline">你的时间故事</span><h2>第 {formatNumber(selectedWeek.index + 1)} 周</h2></div><div className="week-nav" aria-label="切换选中的周"><button type="button" disabled={selectedWeek.index === 0} onClick={() => selectWeek(selectedWeek.index - 1)} aria-label="上一周"><ArrowLeft size={18}/></button><button type="button" disabled={selectedWeek.index === calendar.totalCount - 1} onClick={() => selectWeek(selectedWeek.index + 1)} aria-label="下一周"><ArrowRight size={18}/></button></div></div>
            <p className="detail-date">{formatDate(selectedWeek.startDate)} <span>—</span> {formatDate(selectedWeek.endDate)}</p>
            {selectedWeek.daysBeforeTarget < 7 && <p className="boundary-note">这一格有前 {selectedWeek.daysBeforeTarget} 天计入所选日期范围。</p>}
            <div className="detail-facts"><div><span>周开始时年龄</span><strong>{selectedWeek.age} 岁</strong></div><div><span>本年龄段第几周</span><strong>{selectedWeek.weekOfAge} / {calendar.rows[selectedWeek.age].length}</strong></div></div>
            {isDemo ? <div className="note-empty"><span className="note-empty__icon"><NotebookPen size={20} aria-hidden="true"/></span><strong>把这一周留给自己</strong><p>设置生日后，就能在自己的时间线上写记录。</p><button type="button" onClick={openTimelineSettings}>设置我的生日 <ArrowRight size={16} aria-hidden="true"/></button></div> : <>
              <label className="note-label" htmlFor="weekly-note">{selectedWeek.status === 'future' ? '写给未来的自己' : '记下这一周'}</label>
              <div className="note-wrap"><textarea id="weekly-note" rows={5} maxLength={500} value={selectedNote} placeholder={selectedWeek.status === 'future' ? '那时，你想做什么？' : '一个瞬间、一句感受，或一件想记住的小事……'} onChange={(event) => setNotes((current) => ({ ...current, [noteKey]: event.target.value.slice(0, 500) }))}/><span className="note-count">{selectedNote.length} / 500</span></div>
              <p className={`autosave-label${saveStatus === 'error' || sync.status === 'error' ? ' autosave-label--error' : ''}`}>{mode === 'account' ? <>{accountStatus}{sync.status === 'error' && <button type="button" onClick={sync.retry}>重试同步</button>}</> : saveStatus === 'error' ? '保存失败，请检查浏览器存储设置' : '内容已自动保存在这台设备上'}</p>
            </>}
          </>}
        </aside>
        </div>
        <LifeAtlas calendar={calendar} selectedIndex={effectiveSelectedIndex} onSelectAge={(age) => selectAge(age, true)} />
      </div>

      <section className="explorer-panel" id="week-explorer" aria-labelledby="explorer-title">
        <div className="explorer-heading"><div><span className="section-kicker">逐周浏览</span><h2 id="explorer-title">放大这一年</h2><p>选择一个年龄，再点开属于那一年的每一周。</p></div><button className="locate-button" type="button" aria-label="定位此刻" onClick={goToCurrentWeek}><Crosshair size={16} aria-hidden="true"/>定位此刻</button></div>
        <div className="explorer-toolbar"><div className="age-stepper"><button type="button" aria-label="上一岁" disabled={displayedAge === 0} onClick={() => selectAge(displayedAge - 1)}><ChevronLeft size={18}/></button><select aria-label="查看年龄" value={displayedAge} onChange={(event) => selectAge(Number(event.target.value))}>{calendar.rows.map((_, age) => <option key={age} value={age}>{age} 岁</option>)}</select><button type="button" aria-label="下一岁" disabled={displayedAge >= calendar.rows.length - 1} onClick={() => selectAge(displayedAge + 1)}><ChevronRight size={18}/></button></div><span>{calendar.rows[displayedAge].length} 个连续的七日周</span></div>
        <div className="week-axis" aria-hidden="true"><span>第 1 周</span><span>第 {Math.ceil(calendar.rows[displayedAge].length / 2)} 周</span><span>第 {calendar.rows[displayedAge].length} 周</span></div>
        <WeekGrid row={calendar.rows[displayedAge]} selectedIndex={effectiveSelectedIndex} notes={notes} birthDate={birthDate} onSelect={selectWeek}/>
        {selectedWeek && <div className="selection-quick"><div><span>当前选中</span><strong>第 {formatNumber(selectedWeek.index + 1)} 周</strong><small>{formatDate(selectedWeek.startDate)} — {formatDate(selectedWeek.endDate)}</small></div><button type="button" onClick={() => document.querySelector('.detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>查看与记录 <ArrowRight size={15} aria-hidden="true"/></button></div>}
        <div className="explorer-bottom"><div className="legend" aria-label="周格颜色图例"><span><i className="legend-square past"/>已走过</span><span><i className="legend-square current"/>这一周</span><span><i className="legend-square future"/>还未到来</span><span><i className="legend-square note"/>有记录</span></div><span>每格代表从生日开始的连续 7 天</span></div>
      </section>
    </main>

    <nav className="mobile-dock" aria-label="手机快捷导航"><a href="#top"><House size={19} aria-hidden="true"/>此刻</a><a href="#week-note"><NotebookPen size={19} aria-hidden="true"/>记录</a><a href="#life-atlas"><CalendarDays size={19} aria-hidden="true"/>周历</a></nav>
    <footer className="site-footer"><span>一生一格 <b>·</b> 认真过好每一周</span>{mode === 'preview' && !isDemo && <button type="button" onClick={resetDemo}><RotateCcw size={14} aria-hidden="true"/>清除本机数据</button>}</footer>
    {toast && <div className="toast" role="status">{toast}</div>}
    {sync.conflict && <div className="sync-backdrop"><section className="sync-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title"><h2 id="sync-conflict-title">另一台设备更新了记录</h2><p>云端最近也有修改。请选择要保留的版本，避免无意覆盖。</p><div className="sync-actions"><button type="button" onClick={() => onUseRemote?.(sync.conflict!)}>使用云端版本</button><button type="button" onClick={sync.keepLocal}>保留本机版本并覆盖云端</button></div></section></div>}
    {pendingBirthDate && <div className="sync-backdrop"><section className="sync-dialog" role="dialog" aria-modal="true" aria-labelledby="birth-change-title"><h2 id="birth-change-title">更改出生日期？</h2><p>原生日周历里有 {Object.entries(notes).filter(([key, value]) => key.startsWith(`${birthDate}:`) && value.trim()).length} 条记录。继续后，旧记录会保留；改回原生日即可再次看到。</p><div className="sync-actions"><button type="button" onClick={() => { applyBirthDate(pendingBirthDate); setPendingBirthDate(null); }}>保留旧记录并继续</button><button type="button" onClick={() => { setPendingBirthDate(null); setBirthEditReset((value) => value + 1); }}>取消</button></div></section></div>}
  </div>;
}

type Gate =
  | { kind: 'loading' }
  | { kind: 'auth'; error?: string }
  | { kind: 'preview' }
  | { kind: 'choice'; user: AccountUser; remote: RemoteProfile; local: ProfileData; source: 'legacy' | 'draft'; legacyDraftKey?: string; error?: string; busy?: boolean }
  | { kind: 'account'; user: AccountUser; remote: RemoteProfile; forceSync: boolean; instance: number };

function App() {
  const [gate, setGate] = useState<Gate>({ kind: 'loading' });
  const instanceRef = useRef(0);

  function showAccount(user: AccountUser, remote: RemoteProfile, forceSync = false) {
    setGate({ kind: 'account', user, remote, forceSync, instance: ++instanceRef.current });
  }

  async function enterAccount(user: AccountUser) {
    const remote = await getRemoteProfile();
    const draft = readAccountDraft(user.id);
    const matchedLegacyDraft = draft?.pending ? null : await findLegacyAccountDraft(user.legacyDraft);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const legacy = readLocalProfile(today);
    if (draft?.pending) {
      if (draft.revision === remote.revision) showAccount(user, { profile: draft.profile, revision: draft.revision }, true);
      else setGate({ kind: 'choice', user, remote, local: draft.profile, source: 'draft' });
    } else if (matchedLegacyDraft) setGate({ kind: 'choice', user, remote, local: matchedLegacyDraft.draft.profile, source: 'draft', legacyDraftKey: matchedLegacyDraft.storageKey });
    else if (legacy && !skippedLocalImport(user.id)) setGate({ kind: 'choice', user, remote, local: legacy, source: 'legacy' });
    else showAccount(user, remote);
  }

  useEffect(() => {
    let active = true;
    getSession().then(async ({ user }) => {
      if (!active) return;
      if (user) await enterAccount(user);
      else setGate({ kind: 'auth' });
    }).catch(() => { if (active) setGate({ kind: 'auth', error: '暂时连接不上账号服务。你仍可浏览示例，稍后再试登录。' }); });
    return () => { active = false; };
  }, []);

  async function chooseLocal(choice: Extract<Gate, { kind: 'choice' }>) {
    setGate({ ...choice, busy: true, error: undefined });
    try {
      const saved = await putRemoteProfile(choice.local, choice.remote.revision);
      if (choice.source === 'legacy') clearLocalProfile();
      else if (choice.legacyDraftKey) clearLegacyAccountDraft(choice.legacyDraftKey);
      else clearAccountDraft(choice.user.id);
      showAccount(choice.user, saved);
    } catch (cause) {
      if (cause instanceof Error && 'remote' in cause) {
        setGate({ ...choice, remote: (cause as { remote: RemoteProfile }).remote, busy: false, error: '云端刚刚有更新，请重新确认后再导入。' });
      } else setGate({ ...choice, busy: false, error: cause instanceof Error ? cause.message : '导入失败，请重试' });
    }
  }

  if (gate.kind === 'loading') return <div className="app-loading" role="status"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><p>正在打开你的周历…</p></div>;
  if (gate.kind === 'auth') return <AuthScreen initialError={gate.error} onVerified={enterAccount} onPreview={() => setGate({ kind: 'preview' })}/>;
  if (gate.kind === 'preview') return <CalendarApp mode="preview" onBackToLogin={() => setGate({ kind: 'auth' })}/>;
  if (gate.kind === 'choice') return <div className="choice-page"><div className="choice-card">
    <span className="choice-eyebrow">账号数据</span><h1>这台设备有一份周历</h1><p>{gate.remote.profile ? '先选要保留哪一份。导入本机版本会覆盖账号云端目前的资料。' : '账号里还没有资料，可以把这台设备上的记录导入。'}</p>
    {gate.legacyDraftKey && <p className="choice-legacy-warning">发现旧版尚未同步的本机修改，请比较后选择；选择云端会丢弃这份本机草稿。</p>}
    <div className="choice-versions"><div><span>这台设备</span><strong>{formatDate(gate.local.birthDate)} 出生</strong><small>{Object.keys(gate.local.notes).filter((key) => gate.local.notes[key].trim()).length} 条周记录</small></div><div><span>账号云端</span><strong>{gate.remote.profile ? `${formatDate(gate.remote.profile.birthDate)} 出生` : '还没有资料'}</strong><small>{gate.remote.profile ? `${Object.keys(gate.remote.profile.notes).filter((key) => gate.remote.profile!.notes[key].trim()).length} 条周记录` : '可以导入本机记录'}</small></div></div>
    {gate.error && <p className="choice-error" role="alert">{gate.error}</p>}
    <button className="choice-primary" type="button" disabled={gate.busy} onClick={() => void chooseLocal(gate)}>{gate.busy ? '正在导入…' : gate.remote.profile ? '用本机版本覆盖云端' : '把本机记录导入账号'}</button>
    <button className="choice-secondary" type="button" disabled={gate.busy} onClick={() => { if (gate.source === 'legacy') skipLocalImport(gate.user.id); else if (gate.legacyDraftKey) clearLegacyAccountDraft(gate.legacyDraftKey); else clearAccountDraft(gate.user.id); showAccount(gate.user, gate.remote); }}>{gate.remote.profile ? '使用云端版本' : '暂不导入，从空白开始'}</button>
  </div></div>;
  return <CalendarApp key={gate.instance} mode="account" account={gate.user} initialProfile={gate.remote.profile} initialRevision={gate.remote.revision} forceSyncInitial={gate.forceSync}
    onLogout={async () => { await logout(); setGate({ kind: 'auth' }); }}
    onUseRemote={(remote) => { clearAccountDraft(gate.user.id); showAccount(gate.user, remote); }}/>
}

export default App;
