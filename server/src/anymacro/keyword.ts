import { MatchHelper } from "./match_helper";
import { ParseState, SyntaxNode } from "./syntax_node";

export abstract class SyntaxToken extends SyntaxNode {
  abstract get matcher(): MatchHelper;
  abstract get content(): string;
  abstract set content(str: string);

  get indecisive(): boolean {
    return false;
  }

  parse(parser: ParseState<SyntaxNode>): boolean {
    if (this.indecisive) {
      parser.impl_ref.lastIndicisive = this;
      return true;
    }
    const line = parser.currLine;
    const offset = parser.impl_ref.charNumber;
    const matcher = this.matcher;
    const found = matcher.findIn(line, offset);
    if (found.index !== offset) {
      const lastIndicisive = parser.impl_ref.lastIndicisive;
      if (lastIndicisive === null) {
        return false;
      }
      lastIndicisive.content = line.substring(offset, found.index);
      parser.impl_ref.charNumber = found.index;
    }
    this.content = found.match!;
    parser.impl_ref.charNumber += found.match!.length;
    parser.impl_ref.lastIndicisive = null;
    return true;
  }
}

export abstract class LiteralToken extends SyntaxToken {
  abstract literal: string;
  override get content(): string {
    return this.literal;
  }
  override set content(str: string) {
    this.literal = str;
  }
}

export class KeyWord extends LiteralToken {
  literal: string = "@anymacro";

  static matcher = new MatchHelper("@anymacro");
  get matcher(): MatchHelper {
    return KeyWord.matcher;
  }
}

export class ParentheseLeft extends LiteralToken {
  literal: string = "(";

  static matcher = new MatchHelper("(");
  get matcher(): MatchHelper {
    return ParentheseLeft.matcher;
  }
}

export class ParentheseRight extends LiteralToken {
  literal: string = ")";

  static matcher = new MatchHelper(")");
  get matcher(): MatchHelper {
    return ParentheseRight.matcher;
  }
}

export class Excaper extends LiteralToken {
  literal: string = "\\"; // = "\"

  static matcher = new MatchHelper("\\");
  get matcher(): MatchHelper {
    return Excaper.matcher;
  }
}

export abstract class MatchToken extends SyntaxToken {
  matched: string = "";
  override get content(): string {
    return this.matched;
  }
  override set content(str: string) {
    this.matched = str;
  }
}

export class SymbolName extends MatchToken {
  static matcher = new MatchHelper(/[a-zA-Z0-9_]+/);
  get matcher(): MatchHelper {
    return SymbolName.matcher;
  }
}

export class Argument extends MatchToken {
  repeat: string[] = [];
  override get content(): string {
    return this.repeat.join(",");
  }

  override set content(str: string) {
    this.repeat.push(str);
  }

  static matcher = new MatchHelper(/[ ]{0,}[a-zA-Z0-9_]+[ ]{0,},?/);
  get matcher(): MatchHelper {
    return Argument.matcher;
  }
}

export class DefineTrailing extends MatchToken {
  static matcher = new MatchHelper(/[=~]?/);
  get matcher(): MatchHelper {
    return DefineTrailing.matcher;
  }
}

export class SpaceMust extends MatchToken {
  static matcher = new MatchHelper(/[ ]+/);
  get matcher(): MatchHelper {
    return SpaceMust.matcher;
  }
}

export class SpaceMaybe extends MatchToken {
  static matcher = new MatchHelper(/[ ]{0,}/);
  get matcher(): MatchHelper {
    return SpaceMaybe.matcher;
  }
}

export abstract class InbetweenToken extends SyntaxToken {
  static matcher = new MatchHelper(/./);
  get matcher(): MatchHelper {
    return InbetweenToken.matcher;
  }

  abstract storage: string;
  override get content(): string {
    return this.storage;
  }

  override get indecisive(): boolean {
    return true;
  }
}

export class CommentAlike extends InbetweenToken {
  storage: string = "";
}
