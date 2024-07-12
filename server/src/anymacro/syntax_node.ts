import { SyntaxToken } from "./keyword";

export abstract class SyntaxNode {
  abstract parse(parser: ParseState): boolean;
}

export abstract class ParentNode extends SyntaxNode {
  abstract children: SyntaxNode[];
  isClosed: boolean = false;
}

export interface WithDataReference<T extends unknown> {
  impl_ref: T;
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

interface CursorData {
  lineNumber: number;
  charNumber: number;
  lastIndicisive: SyntaxToken | null;
}

export class ParseState<T extends SyntaxNode = SyntaxNode>
  implements WithDataReference<CursorData>
{
  // content
  private _root: T;
  private _content: string;
  private _lastIndex: number;
  constructor(rootNode: T, document: string, offset: number = 0) {
    this._root = rootNode;
    this._content = document;
    this._lastIndex = offset;
  }

  // readline information
  private _current: string | undefined = undefined;
  impl_ref: CursorData = {
    lineNumber: -1,
    charNumber: -1,
    lastIndicisive: null,
  };
  get currLine(): string {
    if (this._current === undefined) {
      this._current = this.readLine();
      this.impl_ref.lineNumber += 1;
      this.impl_ref.charNumber += 1;
    }
    return this._current;
  }

  set currLine(curr: string | undefined) {
    this._current = curr;
  }

  EOF = () => {
    return this._lastIndex >= this._content.length;
  };

  readLine = () => {
    let nextLineStart = this._lastIndex;
    let nextLineEnd = this._content.indexOf("\n") + 1;
    if (nextLineEnd < 0) {
      // EOF as EOL
      nextLineEnd = this._content.length - 1;
    }

    let nextline: string;
    if (nextLineEnd < nextLineStart) {
      // non blankLine
      nextline = this._content.slice(nextLineStart, nextLineEnd);
    } else {
      nextline = "";
    }
    this._lastIndex = nextLineEnd;
    return nextline;
  };
}
