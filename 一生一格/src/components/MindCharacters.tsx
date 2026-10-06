import './mind-characters.css';

export type CharacterRole = 'rational' | 'monkey' | 'monster';
export type MindCharactersProps = {
  selected: CharacterRole;
  openRole: CharacterRole | null;
  onOpen: (role: CharacterRole) => void;
  decorative?: boolean;
};

const CHARACTERS = [
  { role: 'rational', name: '理性决策者' },
  { role: 'monkey', name: '猴子' },
  { role: 'monster', name: '恐惧怪兽' },
] as const;

export default function MindCharacters({ selected, openRole, onOpen, decorative = false }: MindCharactersProps) {
  return <div className="character-stickers" role={decorative ? undefined : 'group'} aria-label={decorative ? undefined : '点击角色贴图，选择掌舵者并查看简介'}>
    {CHARACTERS.map(({ role, name }) => decorative
      ? <span className={`character-sticker character-sticker--${role}`} key={role} aria-hidden="true"><span className="character-sticker__sprite"/></span>
      : <button key={role} type="button" className={`character-sticker character-sticker--${role}`} aria-label={`选择${name}并查看简介`} aria-pressed={selected === role} aria-expanded={openRole === role} aria-controls={openRole === role ? 'mind-character-intro' : undefined} onClick={() => onOpen(role)} title={name}><span className="character-sticker__sprite" aria-hidden="true"/></button>)}
  </div>;
}
