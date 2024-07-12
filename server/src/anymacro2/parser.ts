import { MatchHelper } from "./match_helper";
import { CursorRange, ParserCursor } from "./parser_cursor";
import { SyntaxNode, keyword } from "./syntax_node";

class ParentNode implements SyntaxNode {
  get matcher(): MatchHelper {
    throw "not implemented";
  }
  
	private _range: CursorRange = new CursorRange(
    new ParserCursor(),
    new ParserCursor()
  );

  get range() {
    this._range.start.copyFrom((this.children.at(0) as SyntaxNode).range.start);
    this._range.end.copyFrom((this.children.at(-1) as SyntaxNode).range.end);
    return this._range;
  }
  children: (SyntaxNode | SyntaxNode[])[];
  constructor(children: (SyntaxNode | SyntaxNode[])[]) {
    this.children = children;
  }
}

abstract class ContentRef {
  abstract _content: string;
}

const secquende = [
  /[ ]{0,}/g,
  undefined,
  /@anyMacro/g,
  /[ ]{1,}/g,
  /[a-zA-Z0-9_]+/g,
  /\(/g,
  [/[ ]{0,}[a-zA-Z0-9_]+[ ]{0,},?/g],
  /\)/g,
  /[=~]?/g,
  undefined,
];

export abstract class DefineNode extends ParentNode implements ContentRef {
  _content: string = undefined as any;
  abstract outputWith(args: string[], indent: string): string;
}

export class DefineTagNode extends DefineNode {
  isCallTag = () => {
    return this.callNote.range.slice(this._content) === "";
  };

  get indent() {
    return this.children[0] as SyntaxNode;
  }

  get keyword() {
    return this.children[2] as SyntaxNode;
  }

  get symbol() {
    return this.children[4] as SyntaxNode;
  }

  get args() {
    return this.children[6] as SyntaxNode[];
  }

  get callNote() {
    return this.children[8] as SyntaxNode;
  }

  get end() {
    return this.children[9] as SyntaxNode;
  }

  getArgsArray() {
    return this.args.map((value) => {
      return this._content
        .substring(value.range.start.offset, value.range.end.offset)
        .trim()
        .replace(",", "");
    });
  }

  outputWith(args: string[], indent: string): string {
    const beforeArgs = new CursorRange(
      this.keyword.range.start,
      this.args.at(0)!.range.start
    ).slice(this._content);
    let afterArgs = new CursorRange(
      this.args.at(-1)!.range.end,
      this.end.range.end
    ).slice(this._content);
    const callNote = this.callNote.range.slice(this._content);
    if (callNote === "=") {
      afterArgs = afterArgs.replace(callNote, "");
    }

    return indent + "// " + beforeArgs + args.join(", ") + afterArgs;
  }
}

export class DefineBodyNode extends DefineNode {
  indent: number;
  args: string[];
  argsMatch: Map<string, SyntaxNode[]>;
  constructor(children: SyntaxNode[], indent: number, args: string[]) {
    super(children);
    this.indent = indent;
    this.args = args;
    this.argsMatch = new Map();
  }

  searchArgs() {
    for (const arg of this.args) {
      const matched = [];
      for (const child of this.children as SyntaxNode[]) {
        const line = this._content!.substring(
          child.range.start.offset,
          child.range.end.offset
        );
        let lastfound = 0;
        while ((lastfound = line.indexOf(arg, lastfound)) > 0) {
          const start = new ParserCursor()
            .copyFrom(child.range.start)
            .goto(this._content!, child.range.start.offset + lastfound);
          const end = new ParserCursor()
            .copyFrom(start)
            .goto(this._content!, start.offset + arg.length);
          matched.push(new SyntaxNode(start, end));
          lastfound += 1;
        }
      }
      this.argsMatch.set(arg, matched);
    }
    return this;
  }

  outputWith(args: string[], indent: string): string {
    const lines = [];
    for (const i of this.children as SyntaxNode[]) {
      let line = indent + i.range.slice(this._content).slice(this.indent);
      for (const j in this.args) {
        line = line.replaceAll(this.args[j], args[j]);
      }
      lines.push(line);
    }

    return lines.join("");
  }
}

export type Macrobody = [DefineTagNode, DefineBodyNode, DefineTagNode];

class KeyWordTagBalancer {
  unblanced: Map<string, DefineTagNode[]>;
  blanced: Array<Macrobody>;
  wrong: Array<DefineTagNode>;
  constructor() {
    this.unblanced = new Map();
    this.blanced = [];
    this.wrong = [];
  }

  getUnblancedStack(symbol: string) {
    if (!this.unblanced.has(symbol)) {
      this.unblanced.set(symbol, []);
    }
    return this.unblanced.get(symbol)!;
  }

  push(symbol: string, node: DefineTagNode, isCloseTag: boolean) {
    if (isCloseTag) {
      const openNode = this.getUnblancedStack(symbol).pop();
      if (!openNode) {
        this.wrong.push(node);
      } else {
        this.blanced.push([openNode, undefined as any, node]);
      }
    } else {
      this.getUnblancedStack(symbol).push(node);
    }
  }
}

var hereDoc = `
import * from "../path/to/file";
const x = "BBBB";
void addMacro(x, y) {
  // @anyMacro ADD_MACRO(x,y)
  x + y;
  // @anyMacro ADD_MACRO(x,y)~
}

const x = "AAAAA";
`.trim();

export class Parser {
  // content
  private _content: string;
  private _cursor: ParserCursor;
  balancer: KeyWordTagBalancer;
  constructor(document: string, offset: number = 0) {
    this._content = document;
    this._cursor = new ParserCursor({ offset });
    this.balancer = new KeyWordTagBalancer();
  }

  searchKeyword = () => {
    const keywords: SyntaxNode[] = [];
    const matcher = keyword.matcher;
    let match: RegExpExecArray | null;
    while ((match = matcher.pattern.exec(this._content))) {
      this._cursor.goto(this._content, match.index);
      const found = new keyword();

      found.range.start.copyFrom(this._cursor).goto(this._content, match.index);
      found.range.end
        .copyFrom(this._cursor)
        .goto(this._content, match.index + match[0].length);
      keywords.push(found);
      this._cursor.copyFrom(found.range.end);
      matcher.pattern.lastIndex = this._cursor.offset;
    }
    return keywords;
  };

  parse = () => {
    const keywords = this.searchKeyword();
    for (const one of keywords) {
      const toFillBetween: number[] = [];
      const captured: (SyntaxNode | SyntaxNode[])[] = [];
      try {
        this._cursor
          .copyFrom(one.range.start)
          .goto(this._content, this._cursor.findLineStart(this._content));

        const lineStart = new ParserCursor().copyFrom(this._cursor);
        const nextLine = new ParserCursor()
          .copyFrom(lineStart)
          .goto(this._content, lineStart.findNextLine(this._content));

        for (let i = 0; i < secquende.length; i++) {
          let pattern = secquende[i];
          let match;
          if (pattern instanceof RegExp) {
            pattern.lastIndex = this._cursor.offset;
            match = regexExecCheckReturn(pattern, this._content);
            if (!match || match?.index > nextLine.offset) {
              break;
            }
            const start = new ParserCursor()
              .copyFrom(this._cursor)
              .goto(this._content, match.index);
            const end = new ParserCursor()
              .copyFrom(start)
              .goto(this._content, match.index + match[0].length);
            captured.push(new SyntaxNode(start, end));
            this._cursor.copyFrom(end);
          } else if (pattern instanceof Array) {
            pattern = pattern[0];
            let repeat = true;
            const capturedInner = [];
            do {
              pattern.lastIndex = this._cursor.offset;
              match = regexExecCheckReturn(pattern, this._content);
              if (!match || match?.index >= nextLine.offset) {
                break;
              }
              const start = new ParserCursor()
                .copyFrom(this._cursor)
                .goto(this._content, match.index);
              const end = new ParserCursor()
                .copyFrom(start)
                .goto(this._content, match.index + match[0].length);
              capturedInner.push(new SyntaxNode(start, end));
              this._cursor.copyFrom(end);
            } while (repeat);
            captured.push(capturedInner);
          } else {
            toFillBetween.push(i);
            captured.push(new SyntaxNode());
            continue;
          }
        }

        for (const i of toFillBetween) {
          (captured[i] as SyntaxNode).range.start.copyFrom(
            i > 0 ? (captured[i - 1] as SyntaxNode).range.end : lineStart
          );
          (captured[i] as SyntaxNode).range.end.copyFrom(
            i + 1 < captured.length
              ? (captured[i + 1] as SyntaxNode).range.start
              : nextLine
          );
        }

        const tagNode = new DefineTagNode(captured);
        const symbolRange = (captured.at(4) as SyntaxNode).range;
        const symbolName = this._content.substring(
          symbolRange.start.offset,
          symbolRange.end.offset
        );
        const isCloseTag =
          (captured.at(8) as SyntaxNode).range.slice(this._content) === "~";
        tagNode._content = this._content;
        this.balancer.push(symbolName, tagNode, isCloseTag);
      } catch (e) {
        this.balancer.wrong.push(new DefineTagNode(captured));
      }
    }

    for (const one of this.balancer.blanced) {
      const indent = (one[0].children.at(0) as SyntaxNode).range.length;
      const args = one[0].getArgsArray();

      const lines: SyntaxNode[] = [];
      const start = one[0].range.start;
      const end = one[2].range.end.findLineStart(this._content) + 1;
      let lineHead = new ParserCursor()
        .copyFrom(start)
        .goto(this._content, start.findNextLine(this._content));

      let lineTail = new ParserCursor()
        .copyFrom(lineHead)
        .goto(this._content, lineHead.findNextLine(this._content));
      while (lineTail.offset <= end) {
        lines.push(new SyntaxNode(lineHead, lineTail));
        lineHead = lineTail;
        lineTail = new ParserCursor()
          .copyFrom(lineHead)
          .goto(this._content, lineHead.findNextLine(this._content));
      }
      one[1] = new DefineBodyNode(lines, indent, args);
      one[1]._content = this._content;
      one[1].searchArgs();
    }
    return this;
  };
}

function regexExecCheckReturn(re: RegExp, target: string) {
  const match = re.exec(target);
  if (!!match && match[0].length === 0) {
    match.index = re.lastIndex;
  }
  return match;
}
