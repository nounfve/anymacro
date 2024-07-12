import { MatchHelper } from "./match_helper";
import { CursorRange, ParserCursor } from "./parser_cursor";

export class SyntaxNode {
  get matcher(): MatchHelper {
    throw "not implemented";
  }

  range: CursorRange;
  constructor(
    start: ParserCursor = new ParserCursor(),
    end: ParserCursor = new ParserCursor()
  ) {
    this.range = new CursorRange(start, end);
  }
}

export abstract class LiteralToken implements SyntaxNode {
  abstract get matcher(): MatchHelper;
  range: CursorRange = new CursorRange(new ParserCursor(), new ParserCursor());
}

export abstract class MatchToken implements SyntaxNode {
  abstract get matcher(): MatchHelper;
  range: CursorRange = new CursorRange(new ParserCursor(), new ParserCursor());
}

export class keyword extends LiteralToken {
  private static _matcher = new MatchHelper("@anyMacro");
  static get matcher(): MatchHelper {
    keyword._matcher.pattern.lastIndex = 0;
    return keyword._matcher;
  }
  get matcher(): MatchHelper {
    return keyword.matcher;
  }
}

export class SpaceMust extends MatchToken {
  static matcher = new MatchHelper(/[ ]+/);
  get matcher(): MatchHelper {
    return SpaceMust.matcher;
  }
}
