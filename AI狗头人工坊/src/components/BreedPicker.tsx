import { useState, type CSSProperties } from "react";
import { Dog, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/session";
import { breeds, getBreed, breedExpressions, type Breed } from "../../shared/breeds";
export function BreedPortrait({ id }: { id: string }) {
  const b = getBreed(id);
  const tile = breeds.findIndex((item) => item.id === id);
  return b ? (
    <span
      aria-hidden="true"
      className="breed-photo"
      style={
        {
          "--breed-x": `${((tile % 6) * 100) / 5}%`,
          "--breed-y": `${Math.floor(tile / 6) * 100 / 3}%`,
        } as CSSProperties
      }
    />
  ) : (
    <span className="breed-symbol" aria-hidden="true">
      <Dog size={26} strokeWidth={1.5} />
    </span>
  );
}
export function BreedPicker() {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const matches = breeds.filter((b) =>
    `${b.label} ${b.english} ${b.aliases}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  function choose(id: Breed) {
    s.setBreed(id);
    s.setDelegateBreed(false);
    setOpen(false);
  }
  return (
    <section className="breed-picker" aria-label="犬种选择">
      <div className="label-row">
        <h2 className="control-label">选一个犬系分身</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="link" disabled={s.busy}>
              全部 {breeds.length} 种 <ArrowRight size={14} />
            </Button>
          </DialogTrigger>
          <DialogContent className="breed-dialog">
            <DialogHeader>
              <DialogTitle>哪一种，像你想象的？</DialogTitle>
              <DialogDescription>
                24 种犬系，24 个神态。照片是 AI 创作参考；嘴型与舌头是可修改的造型建议。
              </DialogDescription>
            </DialogHeader>
            <label className="breed-search">
              <Search size={18} aria-hidden="true" />
              <Input
                aria-label="搜索犬种"
                placeholder="搜索犬种，比如萨摩耶、Corgi"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="breed-directory">
              {matches.map((b) => (
                <button
                  key={b.id}
                  className="breed-entry"
                  aria-pressed={s.breed === b.id && !s.delegateBreed}
                  onClick={() => choose(b.id)}
                >
                  <BreedPortrait id={b.id} />
                  <span>
                    <strong>{b.label}</strong>
                    <small>{b.note}</small>
                    <small className="breed-expression">{breedExpressions[b.id]}</small>
                  </span>
                </button>
              ))}
              {!matches.length && (
                <p className="directory-empty">
                  没有找到这个犬种，可以在下面自己描述。
                </p>
              )}
            </div>
            <div className="custom-breed">
              <label htmlFor="custom-breed">还可以自定义犬种或混合外观</label>
              <div>
                <Input
                  id="custom-breed"
                  maxLength={60}
                  placeholder="例如：黑白花的中华田园犬"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
                <Button
                  disabled={!custom.trim()}
                  onClick={() => {
                    s.setCustomBreed(custom.trim());
                    choose("custom");
                  }}
                >
                  使用
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="breed-quick">
        {breeds.slice(0, 4).map((b) => (
          <button
            key={b.id}
            disabled={s.busy}
            aria-pressed={s.breed === b.id && !s.delegateBreed}
            onClick={() => choose(b.id)}
          >
            <BreedPortrait id={b.id} />
            <span>{b.id === "border" ? "边牧" : b.label}</span>
          </button>
        ))}
      </div>
      <p className="breed-selection">
        {s.delegateBreed
          ? "由助手根据这次想法选择犬种"
          : s.breed === "custom"
            ? s.customBreed
            : `${getBreed(s.breed)?.label} · ${breedExpressions[s.breed]}`}
      </p>
      {s.agentMode && (
        <Button
          className="delegate-breed"
          variant="link"
          disabled={s.busy}
          onClick={() => s.setDelegateBreed(!s.delegateBreed)}
        >
          {s.delegateBreed ? "自己选犬种" : "拿不定主意？交给 Agent"}
        </Button>
      )}
    </section>
  );
}
