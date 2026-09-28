import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { LifeCalendar } from '../lib/lifeCalendar';
import './life-atlas.css';

export type LifeAtlasProps = {
  calendar: LifeCalendar;
  selectedIndex: number;
  onSelectAge: (age: number) => void;
};

const numberFormat = new Intl.NumberFormat('zh-CN');

/** A compact, navigable overview. Individual week cells are visual only. */
export default function LifeAtlas({ calendar, selectedIndex, onSelectAge }: LifeAtlasProps) {
  const headingId = useId();
  const instructionId = useId();
  const ageButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const currentWeek = calendar.currentIndex >= 0 ? calendar.weeks[calendar.currentIndex] : undefined;
  const selectedWeek = calendar.weeks[selectedIndex];
  const selectedAge = selectedWeek?.age ?? currentWeek?.age ?? 0;
  const [focusAge, setFocusAge] = useState(selectedAge);
  const splitAt = Math.ceil(calendar.rows.length / 2);
  const columns = [
    { startAge: 0, rows: calendar.rows.slice(0, splitAt) },
    { startAge: splitAt, rows: calendar.rows.slice(splitAt) },
  ].filter((column) => column.rows.length > 0);
  const progress = calendar.totalCount > 0 ? (calendar.pastCount / calendar.totalCount) * 100 : 0;

  useEffect(() => {
    setFocusAge(selectedAge);
  }, [selectedAge]);

  function handleAgeKeyDown(event: KeyboardEvent<HTMLButtonElement>, age: number) {
    let nextAge: number;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        nextAge = Math.max(0, age - 1);
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        nextAge = Math.min(calendar.rows.length - 1, age + 1);
        break;
      case 'Home':
        nextAge = 0;
        break;
      case 'End':
        nextAge = calendar.rows.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setFocusAge(nextAge);
    ageButtons.current[nextAge]?.focus();
  }

  return (
    <section className="life-atlas" id="life-atlas" aria-labelledby={headingId} aria-describedby={instructionId}>
      <div className="life-atlas__header">
        <div className="life-atlas__heading">
          <span className="life-atlas__eyebrow">LIFE ATLAS / 人生周历</span>
          <h2 id={headingId}>人生全貌</h2>
          <p>出生至所选终点 · {numberFormat.format(calendar.totalCount)} 个连续周格</p>
        </div>
        <div className="life-atlas__progress" aria-label={`已走过 ${progress.toFixed(1)}%`}>
          <div className="life-atlas__progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>已走过 {progress.toFixed(1)}%</span>
        </div>
        <div className="life-atlas__legend" aria-label="周格图例">
          <span><i className="life-atlas__swatch life-atlas__swatch--past" />已走过</span>
          <span><i className="life-atlas__swatch life-atlas__swatch--future" />未来</span>
          <span><i className="life-atlas__swatch life-atlas__swatch--current" />当前周</span>
        </div>
      </div>

      <p id={instructionId} className="life-atlas__sr-only">
        点击年龄标签查看对应年龄。使用方向键选择年龄，按回车键查看。
      </p>

      <div className="life-atlas__columns">
        {columns.map(({ startAge, rows }) => {
          const endAge = startAge + rows.length - 1;
          const currentAgeInColumn = currentWeek && currentWeek.age >= startAge && currentWeek.age <= endAge
            ? currentWeek.age
            : undefined;

          return (
            <div className="life-atlas__column" role="group" aria-label={`${startAge} 至 ${endAge} 岁`} key={startAge}>
              <div className="life-atlas__column-heading">
                <strong>{startAge}—{endAge} 岁</strong>
                {currentAgeInColumn !== undefined && (
                  <span className="life-atlas__column-now">你在这里 · {currentAgeInColumn} 岁</span>
                )}
              </div>
              <div className="life-atlas__years">
                {rows.map((weeks, rowIndex) => {
                  const age = startAge + rowIndex;
                  const isCurrentAge = age === currentWeek?.age;
                  const isSelectedAge = age === selectedWeek?.age;
                  const showAgeLabel = age % 5 === 0 || isCurrentAge || isSelectedAge || age === endAge;

                  return (
                    <div
                      className={`life-atlas__year${age > 0 && age % 10 === 0 ? ' life-atlas__year--decade' : ''}${isCurrentAge ? ' life-atlas__year--current' : ''}`}
                      key={age}
                    >
                      <button
                        className={`life-atlas__age${showAgeLabel ? ' life-atlas__age--visible' : ''}${isSelectedAge ? ' life-atlas__age--selected' : ''}`}
                        type="button"
                        title={`查看 ${age} 岁的详细周历`}
                        aria-label={`查看 ${age} 岁的详细周历`}
                        aria-current={isSelectedAge ? 'true' : undefined}
                        tabIndex={age === focusAge ? 0 : -1}
                        ref={(element) => { ageButtons.current[age] = element; }}
                        onFocus={() => setFocusAge(age)}
                        onKeyDown={(event) => handleAgeKeyDown(event, age)}
                        onClick={() => { setFocusAge(age); onSelectAge(age); }}
                      >
                        <span>{age}</span>
                      </button>
                      <div className="life-atlas__weeks" aria-hidden="true">
                        {weeks.map((week) => {
                          const isSelected = week.index === selectedIndex;
                          const badgeBelow = rowIndex < 3;
                          const badgeNearEnd = week.weekOfAge > 40;
                          return (
                            <span
                              className={`life-atlas__week life-atlas__week--${week.status}${isSelected ? ' life-atlas__week--selected' : ''}`}
                              key={week.index}
                            >
                              {week.status === 'current' && (
                                <span className={`life-atlas__here${badgeBelow ? ' life-atlas__here--below' : ''}${badgeNearEnd ? ' life-atlas__here--end' : ''}`}>
                                  你在这里 · {age} 岁
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="life-atlas__footer"><span>点选年龄数字，放大那一年的每一周</span><strong>正在查看 · {selectedAge} 岁</strong></div>
    </section>
  );
}
