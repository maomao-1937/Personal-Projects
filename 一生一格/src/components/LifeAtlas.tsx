import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { LifeCalendar } from '../lib/lifeCalendar';
import './life-atlas.css';

export type LifeAtlasProps = { calendar: LifeCalendar; selectedIndex: number; onSelectAge: (age: number) => void };
const numberFormat = new Intl.NumberFormat('zh-CN');

/** Decades wrap their actual weekly cells into a compact overview; no weeks are aggregated. */
export default function LifeAtlas({ calendar, selectedIndex, onSelectAge }: LifeAtlasProps) {
  const headingId = useId();
  const instructionId = useId();
  const ageButtons = useRef(new Map<number, HTMLButtonElement>());
  const currentWeek = calendar.weeks[calendar.currentIndex];
  const selectedAge = calendar.weeks[selectedIndex]?.age ?? currentWeek?.age ?? 0;
  const decades = useMemo(() => Array.from({ length: Math.ceil(calendar.rows.length / 10) }, (_, i) => {
    const startAge = i * 10;
    const rows = calendar.rows.slice(startAge, startAge + 10);
    return { startAge, endAge: startAge + rows.length - 1, weeks: rows.flat() };
  }), [calendar]);
  const visibleAges = useMemo(() => decades.flatMap(({ startAge, endAge }) => startAge === endAge ? [startAge] : [startAge, endAge]), [decades]);
  const selectedLabel = visibleAges.includes(selectedAge) ? selectedAge : Math.floor(selectedAge / 10) * 10;
  const [focusAge, setFocusAge] = useState(selectedLabel);
  useEffect(() => setFocusAge(selectedLabel), [selectedLabel]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, age: number) {
    const index = visibleAges.indexOf(age);
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowLeft': nextIndex = index - 1; break;
      case 'ArrowRight': nextIndex = index + 1; break;
      case 'ArrowUp': nextIndex = index - 2; break;
      case 'ArrowDown': nextIndex = index + 2; break;
      case 'Home': nextIndex = 0; break;
      case 'End': nextIndex = visibleAges.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const next = visibleAges[Math.max(0, Math.min(visibleAges.length - 1, nextIndex))];
    setFocusAge(next);
    ageButtons.current.get(next)?.focus();
  }

  function ageLabel(age: number) {
    return <button className="life-atlas__decade-age" type="button" aria-label={`查看 ${age} 岁的详细周历`} title={`查看 ${age} 岁的详细周历`} tabIndex={age === focusAge ? 0 : -1} onFocus={() => setFocusAge(age)} onKeyDown={(event) => navigate(event, age)} onClick={() => { setFocusAge(age); onSelectAge(age); }} ref={(element) => { if (element) ageButtons.current.set(age, element); else ageButtons.current.delete(age); }}>{age}</button>;
  }

  return <section className="life-atlas" id="life-atlas" aria-labelledby={headingId} aria-describedby={instructionId}>
    <div className="life-atlas__header">
      <div className="life-atlas__heading"><h2 id={headingId}>人生全貌</h2></div>
      <div className="life-atlas__legend" aria-label="周格图例"><span><i className="life-atlas__swatch life-atlas__swatch--past"/>过去的周</span><span><i className="life-atlas__swatch life-atlas__swatch--current"/>这一周</span><span><i className="life-atlas__swatch life-atlas__swatch--future"/>未来的周</span></div>
    </div>
    <p id={instructionId} className="life-atlas__sr-only">每格代表一周，按十年分组。点击两侧年龄数字查看对应年份，其他年份可以在下方逐周浏览中选择。使用方向键移动年龄标签，按回车查看。</p>
    <div className="life-atlas__decades">{decades.map(({ startAge, endAge, weeks }) => <div key={startAge} className="life-atlas__decade" role="group" aria-label={`${startAge} 至 ${endAge} 岁，${weeks.length} 周`}>
      {ageLabel(startAge)}
      <div className="life-atlas__decade-weeks" style={{ '--decade-wide-columns': Math.ceil(weeks.length / 3), '--decade-mobile-columns': Math.ceil(weeks.length / 6) } as CSSProperties} aria-hidden="true">{weeks.map((week) => <span key={week.index} title={`第 ${numberFormat.format(week.index + 1)} 周 · ${week.startDate}`} className={`life-atlas__week life-atlas__week--${week.status}${week.index === selectedIndex ? ' life-atlas__week--selected' : ''}`}/>)}</div>
      {endAge !== startAge ? ageLabel(endAge) : <span/>}
    </div>)}</div>
    <div className="life-atlas__compact-footer"><span>每格一周 · 共 {numberFormat.format(calendar.totalCount)} 周</span><span>点年龄，放大那一年</span></div>
  </section>;
}
