import { KeyWord } from "../anymacro/keyword";
import { ParserCursor } from "./parser_cursor";
import { SyntaxNode, keyword } from "./syntax_node";

class ParentNode extends SyntaxNode {
  children: (SyntaxNode | SyntaxNode[])[];
  constructor(children: (SyntaxNode | SyntaxNode[])[]) {
    super();
    this.children = children;
    this.range.start.copyFrom((children.at(0) as SyntaxNode).range.start);
    this.range.end.copyFrom((children.at(-1) as SyntaxNode).range.end);
  }
}

class DefineBodyNode extends ParentNode {
  indent: number;
  args: string[];
  argsMatch: Map<string, SyntaxNode[]>;
  constructor(children: SyntaxNode[], indent: number, args: string[]) {
    super(children);
    this.indent = indent;
    this.args = args;
    this.argsMatch = new Map();
  }

  searchArgs(content: string) {
    for (const arg of this.args) {
      const matched = [];
      for (const child of this.children as SyntaxNode[]) {
        const line = content.substring(
          child.range.start.offset,
          child.range.end.offset
        );
        let lastfound = 0;
        while ((lastfound = line.indexOf(arg, lastfound)) > 0) {
          const start = new ParserCursor()
            .copyFrom(child.range.start)
            .goto(content, child.range.start.offset + lastfound);
          const end = new ParserCursor()
            .copyFrom(start)
            .goto(content, start.offset + arg.length);
          matched.push(new SyntaxNode(start, end));
        }
      }
      this.argsMatch.set(arg, matched);
    }
    return this;
  }
}

class KeyWordTagBalancer {
  unblanced: Map<string, ParentNode[]>;
  blanced: Array<[ParentNode, any, ParentNode]>;
  wrong: Array<ParentNode>;
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

  push(symbol: string, node: ParentNode, isCloseTag: boolean) {
    if (isCloseTag) {
      const openNode = this.getUnblancedStack(symbol).pop();
      if (!openNode) {
        this.wrong.push(node);
      } else {
        this.blanced.push([openNode, undefined, node]);
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

export class Parser<T extends SyntaxNode = SyntaxNode> {
  // content
  private _root: T;
  private _content: string;
  private _cursor: ParserCursor;
  private _balancer: KeyWordTagBalancer;
  constructor(rootNode: T, document: string, offset: number = 0) {
    this._root = rootNode;
    this._content = document;
    this._cursor = new ParserCursor({ offset });
    this._balancer = new KeyWordTagBalancer();
  }

  searchKeyword = () => {
    const keywords: SyntaxNode[] = [];
    const matcher = KeyWord.matcher;
    let match: RegExpExecArray | null;
    while ((match = matcher.pattern.exec(this._content))) {
      this._cursor.goto(this._content, match.index);
      const found = new keyword();

      found.range.start.copyFrom(this._cursor).goto(this._content, match.index);
      found.range.end
        .copyFrom(this._cursor)
        .goto(this._content, match.index + match.length);
      keywords.push(found);
    }
    return keywords;
  };

  parse = () => {
    const keywords = this.searchKeyword();
    for (const one of keywords) {
      this._cursor
        .copyFrom(one.range.start)
        .goto(this._content, this._cursor.findLineStart(this._content));

      const lineStart = new ParserCursor().copyFrom(this._cursor);
      const nextLine = new ParserCursor()
        .copyFrom(lineStart)
        .goto(this._content, lineStart.findNextLine(this._content));

      const toFillBetween: number[] = [];
      const captured: (SyntaxNode | SyntaxNode[])[] = [];
      for (let i = 0; i < secquende.length; i++) {
        let pattern = secquende[i];
        let match;
        if (pattern instanceof RegExp) {
          pattern.lastIndex = this._cursor.offset;
          match = pattern.exec(this._content);
          if (!match || match?.index > nextLine.offset) {
            break;
          }
          const start = new ParserCursor()
            .copyFrom(this._cursor)
            .goto(this._content, match.index);
          const end = new ParserCursor()
            .copyFrom(start)
            .goto(this._content, match.index + match.length);
          captured.push(new SyntaxNode(start, end));
          this._cursor.copyFrom(end);
        } else if (pattern instanceof Array) {
          pattern = pattern[0];
          let repeat = true;
          const capturedInner = [];
          do {
            pattern.lastIndex = this._cursor.offset;
            match = pattern.exec(this._content);
            if (!match || match?.index > nextLine.offset) {
              break;
            }
            const start = new ParserCursor()
              .copyFrom(this._cursor)
              .goto(this._content, match.index);
            const end = new ParserCursor()
              .copyFrom(start)
              .goto(this._content, match.index + match.length);
            capturedInner.push(new SyntaxNode(start, end));
            this._cursor.copyFrom(end);
          } while (repeat);
          captured.push(capturedInner);
        } else {
          toFillBetween.push(i);
          captured.push(new SyntaxNode());
          continue;
        }

        for (const i of toFillBetween) {
          (captured[i] as SyntaxNode).range.start.copyFrom(
            i > 0 ? (captured[i - 1] as SyntaxNode).range.end : lineStart
          );
          (captured[i] as SyntaxNode).range.end.copyFrom(
            i + 1 < captured.length
              ? (captured[i + 1] as SyntaxNode).range.end
              : nextLine
          );
        }
      }

      const parentNode = new ParentNode(captured);
      const symbolRange = (captured.at(4) as SyntaxNode).range;
      const symbolName = this._content.substring(
        symbolRange.start.offset,
        symbolRange.end.offset
      );
      const isCloseTag = (captured.at(8) as SyntaxNode).range.length === 0;
      this._balancer.push(symbolName, parentNode, isCloseTag);
    }

    for (const one of this._balancer.blanced) {
      const indent = (one[0].children.at(0) as SyntaxNode).range.length;
      const args = (one[0].children[6] as SyntaxNode[]).map((value) => {
        return this._content
          .substring(value.range.start.offset, value.range.end.offset)
          .trim();
      });

      const lines: SyntaxNode[] = [];
      let end = one[2].range.end.findLineStart(this._content);
      let cursorHead = new ParserCursor()
        .copyFrom(one[0].range.start)
        .goto(this._content, this._cursor.findNextLine(this._content));

      let cursorTail = new ParserCursor()
        .copyFrom(cursorHead)
        .goto(this._content, cursorHead.findNextLine(this._content));
      while (cursorTail.offset < end) {
        lines.push(new SyntaxNode(cursorHead, cursorTail));
        cursorHead = cursorTail;
        cursorTail = new ParserCursor()
          .copyFrom(cursorHead)
          .goto(this._content, cursorHead.findNextLine(this._content));
      }
      const defineBody = new DefineBodyNode(lines, indent, args).searchArgs(
        this._content
      );
      one[1] = defineBody;
    }
  };
}

const secquende = [
  /[]{0,}/g,
  undefined,
  /@anymacro/g,
  /[]{1,}/g,
  /[a-zA-Z0-9_]+/g,
  /(/g,
  [/[ ]{0,}[a-zA-Z0-9_]+[ ]{0,},?/g],
  /)/g,
  /[=~]?/,
  undefined,
];
