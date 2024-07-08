import { TextDocument } from "vscode-languageserver-textdocument";
import { MacroTokenGroups } from "./anymacro_token_groups";
import { Optional, findLastExtension, parentPathGenerator } from "./utils";

export type MacroBody = {
  start: MacroTokenGroups;
  end: MacroTokenGroups;
};

export class AnyMacroFileTracker {
  macros: Map<string, Map<string, MacroBody>>;
  version: Map<string, number>;
  constructor() {
    this.macros = new Map();
    this.version = new Map();
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
      if (groups.isDefineStart() || groups.isCall()) {
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

  parseAnymacroDocument = (textDocument: TextDocument) => {
    const content = textDocument.getText();
    const found = Object.entries(this.parseContent(content)).filter(
      ([key, value]) => {
        return value.end !== undefined && value.start !== undefined;
      }
    ) as [string, MacroBody][];

    const macroMap = this.getDocument(textDocument.uri);
    macroMap.clear();

    found.forEach(([key, value]) => {
      macroMap.set(key, value);
    });
    this.version.set(textDocument.uri, textDocument.version);
    return macroMap;
  };
}
