import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { validIsoDate, type EndMode } from '../lib/profileStorage';
import './timeline-controls.css';

type TimelineControlsProps = {
  birthDate: string;
  endDate: string;
  endMode: EndMode;
  targetAge: number;
  totalWeeks: number;
  today: string;
  minEndDate: string;
  maxEndDate: string;
  birthInputRef: RefObject<HTMLInputElement | null>;
  onBirthChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onAgeChange: (value: number) => void;
  onModeChange: (value: EndMode) => void;
};

const QUICK_AGES = [60, 75, 90, 100];

function displayDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return `${year} 年 ${month} 月 ${day} 日`;
}

type DateParts = { year: string; month: string; day: string };

function splitDate(value: string): DateParts {
  const [year, month, day] = value.split('-');
  return { year, month, day };
}

type DateFieldsProps = {
  id: string;
  label: string;
  value: string;
  min?: string;
  max: string;
  yearInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
};

function DateFields({ id, label, value, min, max, yearInputRef, onChange }: DateFieldsProps) {
  const [parts, setParts] = useState<DateParts>(() => splitDate(value));
  const [error, setError] = useState('');

  useEffect(() => { setParts(splitDate(value)); setError(''); }, [value]);

  function commit(next: DateParts, allowSingleDigit = false) {
    if (next.year.length !== 4 || !next.month || !next.day) return false;
    if (!allowSingleDigit && (next.month.length !== 2 || next.day.length !== 2)) return false;
    const candidate = `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`;
    if (!validIsoDate(candidate) || (min && candidate < min) || candidate > max) {
      setError(`请输入有效的${label}`);
      return false;
    }
    setError('');
    if (candidate !== value) onChange(candidate);
    return true;
  }

  function edit(part: keyof DateParts, raw: string) {
    const next = { ...parts, [part]: raw.replace(/\D/g, '').slice(0, part === 'year' ? 4 : 2) };
    setParts(next);
    setError('');
    commit(next);
  }

  function finish() {
    if (commit(parts, true)) {
      setParts({ year: parts.year, month: parts.month.padStart(2, '0'), day: parts.day.padStart(2, '0') });
    } else {
      setParts(splitDate(value));
    }
  }

  return <>
    <div className={`timeline-controls__date-field timeline-controls__date-field--segments${id === 'end-date' ? ' timeline-controls__date-field--end' : ''}`} role="group" aria-label={label}>
      <input id={id} ref={yearInputRef} type="text" inputMode="numeric" maxLength={4} value={parts.year} placeholder="YYYY"
        aria-label={`${label}年份`} aria-invalid={Boolean(error)} onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => edit('year', event.target.value)} onBlur={finish}/>
      <span aria-hidden="true">/</span>
      <input type="text" inputMode="numeric" maxLength={2} value={parts.month} placeholder="MM"
        aria-label={`${label}月份`} aria-invalid={Boolean(error)} onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => edit('month', event.target.value)} onBlur={finish}/>
      <span aria-hidden="true">/</span>
      <input type="text" inputMode="numeric" maxLength={2} value={parts.day} placeholder="DD"
        aria-label={`${label}日期`} aria-invalid={Boolean(error)} onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => edit('day', event.target.value)} onBlur={finish}/>
    </div>
    {error && <small className="timeline-controls__date-error" role="alert">{error}</small>}
  </>;
}

export default function TimelineControls({
  birthDate, endDate, endMode, targetAge, totalWeeks, today, minEndDate, maxEndDate,
  birthInputRef, onBirthChange, onEndDateChange, onAgeChange, onModeChange,
}: TimelineControlsProps) {
  const progress = `${((targetAge - 1) / 119) * 100}%`;

  return <section className="timeline-controls" aria-labelledby="timeline-controls-title">
    <div className="timeline-controls__heading">
      <div>
        <span className="timeline-controls__eyebrow"><i/> YOUR TIMELINE / 时间坐标</span>
        <h2 id="timeline-controls-title">设定你的时间坐标<span>。</span></h2>
        <p>从出生的那一天开始，决定周历要展示到哪里。</p>
      </div>
      <div className="timeline-controls__count" aria-label={`共 ${totalWeeks.toLocaleString('zh-CN')} 个周格`}>
        <strong>{totalWeeks.toLocaleString('zh-CN')}</strong><span>个周格</span>
      </div>
    </div>

    <div className="timeline-controls__grid">
      <div className="timeline-controls__start">
        <div className="timeline-controls__step"><b>01</b><span>你的起点</span><small>START</small></div>
        <label htmlFor="birth-date">出生日期</label>
        <DateFields id="birth-date" label="出生日期" value={birthDate} max={today} yearInputRef={birthInputRef} onChange={onBirthChange}/>
        <p className="timeline-controls__field-note">第一格，从这一天开始。</p>
        <div className="timeline-controls__birth-mark" aria-hidden="true"><span>BORN IN</span><strong>{birthDate.slice(0, 4)}</strong></div>
      </div>

      <div className="timeline-controls__end">
        <div className="timeline-controls__step"><b>02</b><span>展示终点</span><small>END</small></div>
        <div className="timeline-controls__mode" role="group" aria-label="终点设置方式">
          <button type="button" className={endMode === 'age' ? 'active' : ''} aria-pressed={endMode === 'age'} onClick={() => onModeChange('age')}>按年龄</button>
          <button type="button" className={endMode === 'date' ? 'active' : ''} aria-pressed={endMode === 'date'} onClick={() => onModeChange('date')}>自定义日期</button>
        </div>
        {endMode === 'age' ? <div className="timeline-controls__age-panel">
          <div className="timeline-controls__age-main">
            <span>展示到</span>
            <div className="timeline-controls__age-value">
              <button type="button" aria-label="展示年龄减少一岁" disabled={targetAge <= 1} onClick={() => onAgeChange(targetAge - 1)}><Minus size={17} aria-hidden="true"/></button>
              <strong>{targetAge}</strong><em>岁</em>
              <button type="button" aria-label="展示年龄增加一岁" disabled={targetAge >= 120} onClick={() => onAgeChange(targetAge + 1)}><Plus size={17} aria-hidden="true"/></button>
            </div>
          </div>
          <input className="timeline-controls__range" type="range" min="1" max="120" step="1" value={targetAge}
            style={{ '--range-progress': progress } as CSSProperties}
            aria-label="展示到的年龄" aria-valuetext={`${targetAge} 岁`}
            onChange={(event) => onAgeChange(Number(event.target.value))}/>
          <div className="timeline-controls__scale"><span>1 岁</span><span>60 岁</span><span>120 岁</span></div>
          <div className="timeline-controls__quick" aria-label="常用展示年龄">
            {QUICK_AGES.map((age) => <button key={age} type="button" className={targetAge === age ? 'active' : ''} aria-pressed={targetAge === age} onClick={() => onAgeChange(age)}>{age} 岁</button>)}
          </div>
        </div> : <div className="timeline-controls__custom-panel">
          <label htmlFor="end-date">死亡日期</label>
          <DateFields id="end-date" label="死亡日期" value={endDate} min={minEndDate} max={maxEndDate} onChange={onEndDateChange}/>
          <p>选好日期后，周历会按这个终点重新排列。</p>
        </div>}
      </div>
    </div>

    <div className="timeline-controls__path" aria-label={`从 ${displayDate(birthDate)} 展示到 ${displayDate(endDate)}`}>
      <span><i/> {displayDate(birthDate)}</span>
      <span className="timeline-controls__path-line" aria-hidden="true"><ArrowRight size={16}/></span>
      <span>{displayDate(endDate)} <b>终点</b></span>
    </div>
  </section>;
}
