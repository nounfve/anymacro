import { MacroTokenGroups } from "./anymacro_token_groups";
import { Optional } from "./utils";

type MacroPath = {
  fileName: string;
  symbolName: string;
};

type MacroBody = {
  start: MacroTokenGroups;
  end: MacroTokenGroups;
};

export class AnyMacroFileTracker {
  macros: Map<string, Map<string, MacroBody>>;
  constructor() {
    this.macros = new Map();
  }

  getDocument = (path: string) => {
    this.macros.has(path) || this.macros.set(path, new Map());
    return this.macros.get(path)!;
  };

  parseContent = (content: string) => {
    const regEx = MacroTokenGroups.regExp();
    let match: RegExpExecArray | null;
    const found: { [key: string]: Optional<MacroBody> } = {};

    while ((match = regEx.exec(content))) {
      const groups = new MacroTokenGroups(match);
      if (groups.isDefineStart() ||groups.isCall()) {
        // found a define start
        if (!!found[groups.symbol]) {
          // skip for existed symbol
          continue;
        }
        found[groups.symbol] = { start: groups, end: undefined };
      } else if (groups.isDefineClose()) {
        // found a define end
        if (!found[groups.symbol] || !!found[groups.symbol]?.end) {
          // skip for no start or already ended.
          continue;
        }
        found[groups.symbol]!.end = groups;
      } else {
        // unknow syntax
      }
    }
    return found;
  };

  parseAnymacroDocument = (path: string, content: string) => {
    const found = Object.entries(this.parseContent(content)).filter(
      ([key, value]) => {
        return value.end !== undefined && value.start !== undefined;
      }
    ) as [string, MacroBody][];

    const macroMap = this.getDocument(path);
    macroMap.clear();

    found.forEach(([key, value]) => {
      macroMap.set(key, value);
    });
    return macroMap;
  };
}
