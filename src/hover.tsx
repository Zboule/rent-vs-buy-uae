// Links the options panel and the graph while hovering: a hovered chip lights every line that
// uses its value, a hovered line lights the chips it is made of.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ChipRef { key: string; v: number | string }
export interface LineRef { combo: Record<string, number | string>; keys: string[] } // keys = options this line depends on

interface Hover {
  chip: ChipRef | null;
  setChip: (c: ChipRef | null) => void;
  line: LineRef | null;
  setLine: (l: LineRef | null) => void;
}

const Ctx = createContext<Hover>({ chip: null, setChip: () => {}, line: null, setLine: () => {} });

export function HoverProvider({ children }: { children: ReactNode }) {
  const [chip, setChip] = useState<ChipRef | null>(null);
  const [line, setLine] = useState<LineRef | null>(null);
  const v = useMemo(() => ({ chip, setChip, line, setLine }), [chip, line]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const useHover = () => useContext(Ctx);

/** does this line use the chip's value? (a line that ignores the option uses all of its values) */
export const lineUses = (combo: Record<string, number | string>, keys: string[], chip: ChipRef) =>
  !keys.includes(chip.key) || combo[chip.key] === chip.v;
