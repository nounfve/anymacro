import { Optional } from "./utils";

export class MacroTokenGroups {
  baseOffset: number;

  promot: string;
  symbol: string;
  args: string;
  end: string;

  constructor(match: RegExpExecArray) {
    const groups = match.groups as any as Optional<MacroTokenGroups>;
    this.baseOffset = match.index;

    this.promot = groups.promot ? groups.promot : "";
    this.symbol = groups.symbol ? groups.symbol : "";
    this.args = groups.args ? groups.args : "";
    this.end = groups.end ? groups.end : "";
  }

  isDefineStart = () => {
    return this.end === "=";
  };

  isDefineClose = () => {
    return this.end === "~";
  };

  isCall = () => {
    return this.end === "";
  };

  offSetStart = <K extends keyof MacroTokenGroups>(key: K) => {
    let _offset = this.baseOffset;
    for (;;) {
      if (key === "promot") break;
      _offset += this.promot.length;
      if (key === "symbol") break;
      _offset += this.symbol.length;
      if (key === "args") break;
      _offset += this.args.length;
      if (key === "end") break;
    }
    return _offset;
  };

  offsetEnd = <K extends keyof MacroTokenGroups>(key: K) => {
    return this.offSetStart(key) + (this[key] as string).length;
  };

  static regExp = () => {
    return /(?<promot>@anyMacro\ )(?<symbol>[a-zA-Z_]+)(?<args>\([a-zA-Z,_\ ]+\))?(?<end>[=~])?(?<trailing>\s)?\n/g;
  };
}
