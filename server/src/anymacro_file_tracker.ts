import { TextDocument } from "vscode-languageserver-textdocument";
import { DefineTagNode, Macrobody, Parser } from "./anymacro2/parser";
import { DecoratorResponse } from "./decorator_export";

export class AnyMacroFileTracker {
  macros: Map<string, Parser>;
  version: Map<string, number>;
  constructor() {
    this.macros = new Map();
    this.version = new Map();
  }

  getDocument = (path: string) => {
    this.macros.has(path) || this.macros.set(path, new Parser(""));
    return this.macros.get(path)!;
  };

  parseAnymacroDocument = (textDocument: TextDocument) => {
    const content = textDocument.getText();
    const parser = new Parser(content).parse();

    this.macros.set(textDocument.uri, parser);
    return parser;
  };

  static macroGenerateDecorator(
    parser: Parser,
    response: DecoratorResponse,
    textDocument: TextDocument
  ): DecoratorResponse {
    const defineTagDecorator = (defineTag: DefineTagNode) => {
      defineTag.keyword &&
        response.keyword.push({
          range: defineTag.keyword.range.toVSCodeRange(textDocument),
        });
      defineTag.symbol &&
        response.symbol.push({
          range: defineTag.symbol.range.toVSCodeRange(textDocument),
        });
      // arglist
      defineTag.args?.forEach((value) => {
        response.argument.push({
          range: value.range.toVSCodeRange(textDocument),
        });
      });
    };

    parser.balancer.blanced.forEach((value, key) => {
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

    parser.balancer.unblanced.forEach((value) => {
      for (const tag of value) {
        defineTagDecorator(tag);
      }
    });

    parser.balancer.wrong.forEach((value) => {
      defineTagDecorator(value);
    });

    return response;
  }
}
