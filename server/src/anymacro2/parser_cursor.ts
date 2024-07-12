export class ParserCursorParams {
  offset?: number;
}

export class ParserCursor {
  offset: number;
  lineIdx: number;
  charIdx: number;
  constructor(params?: ParserCursorParams) {
    this.offset = params?.offset || 0;
    this.lineIdx = 0;
    this.charIdx = 0;
  }

  findNextLine = (_content: string) => {
    let lineEnd = _content.indexOf("\n", this.offset);
    if (lineEnd < 0) {
      // EOF as EOL
      lineEnd = _content.length - 1;
    }
    // return firstPosition
    return lineEnd + 1;
  };

  findLineStart = (_content: string) => {
    let offsetCpy = this.offset - 2;
    offsetCpy = _content.lastIndexOf("\n", offsetCpy);
    if (offsetCpy < 0) {
      // reach head of file
      offsetCpy = -1;
    }
    return offsetCpy + 1;
  };

  findPrevLine = (_content: string) => {
    const offsetCache = this.offset;
    for (let i = 0; i < 2; i++) {
      this.offset = this.findLineStart(_content);
    }
    const offsetResult = this.offset;
    this.offset = offsetCache;
    return offsetResult;
  };

  gotoNext = (_content: string, position: number) => {
    this.charIdx = position - this.offset;
    while (this.offset < position) {
      const nextLine = this.findNextLine(_content);
      if (nextLine < position) {
        this.charIdx -= this.charIdx - (nextLine - this.offset);
        this.offset = nextLine;
        this.lineIdx += 1;
      } else {
        this.offset = position;
        this.charIdx = nextLine - position;
      }
    }
  };

  gotoPrev = (_content: string, position: number) => {
    while (this.offset > position) {
      const prevLine = this.findPrevLine(_content);
      if (prevLine > position) {
        this.offset = prevLine;
        this.lineIdx -= 1;
      } else {
        this.offset = position;
        this.charIdx = position - prevLine;
      }
    }
  };

  reset = () => {
    this.offset = 0;
    this.lineIdx = 0;
    this.charIdx = 0;
    return this;
  };

  set = (offset?: number, lineIdx?: number, charIdx?: number) => {
    this.offset = offset || this.offset;
    this.lineIdx = lineIdx || this.lineIdx;
    this.charIdx = charIdx || this.charIdx;
    return this;
  };

  copyFrom = (that: ParserCursor) => {
    this.offset = that.offset;
    this.lineIdx = that.lineIdx;
    this.charIdx = that.charIdx;
    return this;
  };

  goto = (_content: string, position: number) => {
    if (position < this.offset) {
      this.gotoPrev(_content, position);
    } else {
      this.gotoNext(_content, position);
    }
    return this;
  };
}

export class CursorRange {
  start: ParserCursor;
  end: ParserCursor;
  constructor(_start: ParserCursor, _end: ParserCursor) {
    this.start = _start;
    this.end = _end;
  }

  get length(): number {
    return this.end.offset - this.start.offset;
  }

  slice(_content: string) {
    return _content.slice(this.start.offset, this.end.offset);
  }
}
