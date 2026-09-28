import { useId, useState } from 'react';
import './mind-characters.css';

export type CharacterRole = 'rational' | 'monkey' | 'monster';

export type MindCharactersProps = {
  selected: CharacterRole;
  openRole: CharacterRole | null;
  onOpen: (role: CharacterRole) => void;
  decorative?: boolean;
};

/** Three original characters sharing one small, responsive cockpit illustration. */
export default function MindCharacters({ selected, openRole, onOpen, decorative = false }: MindCharactersProps) {
  const id = useId().replace(/:/g, '');
  const [hoveredRole, setHoveredRole] = useState<CharacterRole | null>(null);
  const featured = hoveredRole ?? openRole ?? selected;
  const monsterAwake = featured === 'monster';
  const selectedLabel = selected === 'rational' ? '理性决策者' : selected === 'monkey' ? '猴子' : '恐惧怪兽';
  const openLabel = openRole === 'rational' ? '理性决策者' : openRole === 'monkey' ? '猴子' : '恐惧怪兽';
  const description = `三位角色同时站在意识驾驶舱：蓝绿色的理性决策者、暖橙色的猴子和珊瑚红色的恐惧怪兽。当前掌舵者是${selectedLabel}；${openRole ? `正在查看${openLabel}的简介` : `恐惧怪兽${monsterAwake ? '醒来' : '睡着'}`}。`;

  return (
    <div className={`mind-characters mind-characters--${featured} mind-characters--selected-${selected}${hoveredRole ? ` mind-characters--interacting-${hoveredRole}` : ''}`}>
      <svg viewBox="0 0 320 128" xmlns="http://www.w3.org/2000/svg" role={decorative ? undefined : 'img'} aria-hidden={decorative} aria-label={decorative ? undefined : description}>
        <defs>
          <linearGradient id={`${id}-background`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#203A43" />
            <stop offset="1" stopColor="#10242D" />
          </linearGradient>
          <linearGradient id={`${id}-rational`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A1E4D7" />
            <stop offset="1" stopColor="#51AC9D" />
          </linearGradient>
          <linearGradient id={`${id}-monkey`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FBC17A" />
            <stop offset="1" stopColor="#DB8847" />
          </linearGradient>
          <linearGradient id={`${id}-monster`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF9E8E" />
            <stop offset="1" stopColor="#DE6869" />
          </linearGradient>
          <radialGradient id={`${id}-mint-halo`}>
            <stop offset="0" stopColor="#7BD7C3" stopOpacity=".48" />
            <stop offset="1" stopColor="#7BD7C3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-amber-halo`}>
            <stop offset="0" stopColor="#FFC683" stopOpacity=".5" />
            <stop offset="1" stopColor="#FFC683" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-coral-halo`}>
            <stop offset="0" stopColor="#FF9289" stopOpacity=".58" />
            <stop offset="1" stopColor="#FF9289" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="320" height="128" rx="15" fill={`url(#${id}-background)`} />
        <path d="M17 76C66 21 129 18 175 34c56 19 91 4 128-15" fill="none" stroke="#789A9D" strokeOpacity=".13" strokeWidth="1.2" />
        <path d="M10 101c60-57 125-55 167-36 47 21 88 13 136-17" fill="none" stroke="#789A9D" strokeOpacity=".11" strokeWidth="1.2" />
        <circle cx="43" cy="25" r="1.5" fill="#9BCEC4" fillOpacity=".4" />
        <circle cx="286" cy="34" r="1.5" fill="#9BCEC4" fillOpacity=".32" />
        <circle cx="277" cy="15" r="1.5" fill="#FFB66E" fillOpacity=".37" />

        <circle className="mind-characters__halo mind-characters__halo--rational" cx="80" cy="71" r="66" fill={`url(#${id}-mint-halo)`} />
        <circle className="mind-characters__halo mind-characters__halo--monkey" cx="229" cy="71" r="66" fill={`url(#${id}-amber-halo)`} />
        <circle className="mind-characters__halo mind-characters__halo--panic" cx="162" cy="45" r="49" fill={`url(#${id}-coral-halo)`} />

        <path d="M0 112c67-10 115-12 160-11 55 1 106 4 160 12v15H0Z" fill="#1B3840" />
        <path d="M12 116c77-12 216-12 296 0" fill="none" stroke="#537A7B" strokeOpacity=".55" strokeWidth="1.3" />

        <g transform="translate(65 7) scale(.62 .58)">
        <g className="mind-characters__monster">
          <path d="M139 58l-2-25 13 12 10-19 9 18 15-10-4 25c11 8 17 21 15 36-2 21-16 33-34 33-20 0-34-12-36-32-2-17 3-29 14-38Z" fill={`url(#${id}-monster)`} stroke="#F5ADA1" strokeOpacity=".45" strokeWidth="1.5" />
          <path d="M129 75c-9 3-13 13-11 22m74-23c9 2 14 12 12 22" fill="none" stroke="#ED827C" strokeWidth="8" strokeLinecap="round" />
          {monsterAwake ? (
            <>
              <path d="M140 76l13 3m29-3-13 3" stroke="#6A3745" strokeWidth="3.5" strokeLinecap="round" />
              <ellipse cx="149" cy="88" rx="4.5" ry="7" fill="#28323D" />
              <ellipse cx="173" cy="88" rx="4.5" ry="7" fill="#28323D" />
              <path d="M149 106c7-7 18-7 25 0-2 9-7 13-13 13s-10-4-12-13Z" fill="#743F49" />
              <path d="M154 107l3 4 4-4 4 4 4-4" fill="none" stroke="#FFE1CF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M111 58l-8-7m112 6 8-7M161 16V6" stroke="#FF9B8A" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M139 87c4 4 10 4 14 0m17 0c4 4 10 4 14 0" fill="none" stroke="#783F4B" strokeWidth="3" strokeLinecap="round" />
              <path d="M155 107c4 3 9 3 13 0" fill="none" stroke="#9B4E59" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M199 37h9l-8 9h9m3-22h6l-6 7h6" fill="none" stroke="#F4B8AE" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          <circle cx="137" cy="101" r="3.5" fill="#FFB8A4" fillOpacity=".5" />
          <circle cx="185" cy="101" r="3.5" fill="#FFB8A4" fillOpacity=".5" />
        </g>
        </g>

        <g transform="translate(-1 -12) scale(.85 .62)">
        <g className="mind-characters__rational">
          <path d="M55 177c2-24 11-36 33-37 23-1 34 13 36 37l-8 25H61Z" fill="#327E79" stroke="#76C9BC" strokeOpacity=".4" strokeWidth="1.5" />
          <path d="M70 143c9 8 24 8 35 0l-9 22H79Z" fill="#68BDB0" />
          <path d="M60 103c0-24 10-40 28-41 19-1 31 15 31 40 0 27-13 44-31 44-18 0-28-17-28-43Z" fill={`url(#${id}-rational)`} />
          <path d="M60 103c-2-22 9-39 29-40 20-1 31 14 30 38-8 0-13-3-17-10-11 9-26 13-42 12Z" fill="#244E55" />
          <path d="M70 108c10 5 26 5 36 0" fill="none" stroke="#357C79" strokeOpacity=".65" strokeWidth="1.5" />
          <ellipse cx="76" cy="114" rx="2.8" ry="3.6" fill="#1D464D" />
          <ellipse cx="100" cy="114" rx="2.8" ry="3.6" fill="#1D464D" />
          <path d="M80 130c5 4 12 4 17 0" fill="none" stroke="#2A6D6B" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M65 155c-8 7-12 18-11 26m67-25c7 6 10 16 8 25" fill="none" stroke="#58A79D" strokeWidth="12" strokeLinecap="round" />
          <circle cx="91" cy="183" r="22" fill="#193C43" stroke="#9BE1D1" strokeWidth="3" />
          <circle cx="91" cy="183" r="5" fill="#9BE1D1" />
          <path d="M91 161v17m-21 10 16-4m26 4-16-4" stroke="#9BE1D1" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="70" cy="179" r="6" fill="#A3E2D2" />
          <circle cx="112" cy="179" r="6" fill="#A3E2D2" />
        </g>
        </g>

        <g transform="translate(64 -10) scale(.7 .6)">
        <g className="mind-characters__monkey">
          <path d="M254 161c29 3 42-10 39-24-3-15-22-16-25-5-2 8 6 14 13 10" fill="none" stroke="#D88449" strokeWidth="9" strokeLinecap="round" />
          <path d="M197 179c2-26 14-39 34-41 23-1 37 15 39 40l-7 25h-60Z" fill="#C9763E" stroke="#F7B878" strokeOpacity=".6" strokeWidth="1.5" />
          <ellipse cx="197" cy="103" rx="16" ry="18" fill="#C6763F" />
          <ellipse cx="197" cy="103" rx="9" ry="11" fill="#F3BD82" />
          <ellipse cx="263" cy="103" rx="16" ry="18" fill="#C6763F" />
          <ellipse cx="263" cy="103" rx="9" ry="11" fill="#F3BD82" />
          <path d="M193 105c0-26 15-44 37-44s38 17 38 44c0 25-16 42-38 42s-37-17-37-42Z" fill={`url(#${id}-monkey)`} />
          <path d="M208 101c7-8 37-8 44 0 6 9 5 26-6 34-8 6-26 6-34 0-11-8-12-25-4-34Z" fill="#F5CB99" />
          <path d="M210 92c8-4 15-4 20-2m20 2c-8-4-15-4-20-2" fill="none" stroke="#A85D39" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="217" cy="109" rx="2.8" ry="3.7" fill="#5D3C36" />
          <ellipse cx="244" cy="109" rx="2.8" ry="3.7" fill="#5D3C36" />
          <ellipse cx="230" cy="120" rx="14" ry="10" fill="#FFE0B1" />
          <path d="M227 117h6l-3 4Z" fill="#8B5944" />
          <path d="M223 126c4 4 11 4 15 0" fill="none" stroke="#9C624B" strokeWidth="2" strokeLinecap="round" />
          <path d="M205 158c4 9 11 14 20 16m32-16c-4 9-11 14-20 16" fill="none" stroke="#E9A367" strokeWidth="12" strokeLinecap="round" />
          <path d="m231 158 10 10-10 10-10-10Z" fill="#FFD185" stroke="#FFF2CF" strokeWidth="1.6" />
          <path d="M231 157v21m-10-10h20" stroke="#F2A443" strokeOpacity=".7" strokeWidth="1" />
          <circle cx="224" cy="173" r="5" fill="#F8C58B" />
          <circle cx="238" cy="173" r="5" fill="#F8C58B" />
        </g>
        </g>

        <path d="M12 116c77-12 216-12 296 0" fill="none" stroke="#9BC0B9" strokeOpacity=".34" strokeWidth="1.3" />
        <circle cx="160" cy="121" r="2" fill="#FFB66E" fillOpacity=".75" />
        <circle cx="147" cy="122" r="1" fill="#9AD8C9" fillOpacity=".5" />
        <circle cx="173" cy="122" r="1" fill="#9AD8C9" fillOpacity=".5" />
      </svg>
      {!decorative && <div className="mind-characters__hotspots">
        <button className="mind-characters__hotspot mind-characters__hotspot--rational" type="button" onClick={() => onOpen('rational')} onMouseEnter={() => setHoveredRole('rational')} onMouseLeave={() => setHoveredRole(null)} onFocus={() => setHoveredRole('rational')} onBlur={() => setHoveredRole(null)} aria-label="选择理性决策者并查看简介" aria-controls={openRole ? 'mind-character-intro' : undefined} aria-expanded={openRole === 'rational'} aria-pressed={selected === 'rational'} />
        <button className="mind-characters__hotspot mind-characters__hotspot--monster" type="button" onClick={() => onOpen('monster')} onMouseEnter={() => setHoveredRole('monster')} onMouseLeave={() => setHoveredRole(null)} onFocus={() => setHoveredRole('monster')} onBlur={() => setHoveredRole(null)} aria-label="选择恐惧怪兽并查看简介" aria-controls={openRole ? 'mind-character-intro' : undefined} aria-expanded={openRole === 'monster'} aria-pressed={selected === 'monster'} />
        <button className="mind-characters__hotspot mind-characters__hotspot--monkey" type="button" onClick={() => onOpen('monkey')} onMouseEnter={() => setHoveredRole('monkey')} onMouseLeave={() => setHoveredRole(null)} onFocus={() => setHoveredRole('monkey')} onBlur={() => setHoveredRole(null)} aria-label="选择猴子并查看简介" aria-controls={openRole ? 'mind-character-intro' : undefined} aria-expanded={openRole === 'monkey'} aria-pressed={selected === 'monkey'} />
      </div>}
      <div className="mind-characters__labels" aria-hidden="true">
        <span className="mind-characters__label mind-characters__label--rational"><i />理性决策者</span>
        <span className="mind-characters__label mind-characters__label--monster"><i />恐惧怪兽</span>
        <span className="mind-characters__label mind-characters__label--monkey"><i />猴子</span>
      </div>
    </div>
  );
}
