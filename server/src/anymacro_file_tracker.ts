import { TextDocument } from "vscode-languageserver-textdocument";
import { DefineTagNode, Macrobody, Parser } from "./anymacro2/parser";
import { DecoratorResponse } from "./decorator_export";

export class AnyMacroFileTracker {
  macros: Map<string, Map<string, Macrobody>>;
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
    const parser = new Parser(content).parse();
    return parser;
    // // -------------------------------------------------
    // const regEx = MacroTokenGroups.regExp();
    // let match: RegExpExecArray | null;
    // const found: { [key: string]: Optional<MacroBody> } = {};

    // while ((match = regEx.exec(content))) {
    //   const groups = new MacroTokenGroups(match);
    //   if (groups.isDefineStart() || groups.isCall()) {
    //     // found a define start
    //     if (!!found[groups.symbol]) {
    //       // skip for existed symbol
    //       continue;
    //     }
    //     found[groups.symbol] = { start: groups, end: undefined };
    //   } else if (groups.isDefineClose()) {
    //     // found a define end
    //     if (!found[groups.symbol] || !!found[groups.symbol]?.end) {
    //       // skip for no start or already ended.
    //       continue;
    //     }
    //     found[groups.symbol]!.end = groups;
    //   } else {
    //     // unknow syntax
    //   }
    // }
    // return found;
  };

  parseAnymacroDocument = (textDocument: TextDocument) => {
    const content = textDocument.getText();
    const parser = this.parseContent(content);

    const macroMap = this.getDocument(textDocument.uri);
    macroMap.clear();

    parser.balancer.blanced.forEach((body) => {
      const symbolName = body[0].symbol.range.slice(body[0]._content);
      macroMap.set(symbolName, body);
    });
    this.version.set(textDocument.uri, textDocument.version);
    return macroMap;
  };

  static macroGenerateDecorator(
    macros: Map<string, Macrobody>,
    textDocument: TextDocument
  ): DecoratorResponse {
    const response: DecoratorResponse = DecoratorResponse.blank();

    const defineTagDecorator = (defineTag: DefineTagNode) => {
      response.keyword.push({
        range: defineTag.keyword.range.toVSCodeRange(textDocument),
      });
      response.symbol.push({
        range: defineTag.symbol.range.toVSCodeRange(textDocument),
      });
      // arglist
      defineTag.args.forEach((value) => {
        response.argument.push({
          range: value.range.toVSCodeRange(textDocument),
        });
      });
    };

    macros.forEach((value, key) => {
      // open tag
      defineTagDecorator(value[0]);
      // body
      for (const [arg, matched] of value[1].argsMatch) {
        for (const one of matched) {
          response.argument.push({
            range: one.range.toVSCodeRange(textDocument!),
          });
        }
      }
      // close tag
      defineTagDecorator(value[2]);
    });

    return response;
  }
}
