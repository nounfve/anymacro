import {
  Argument,
  DefineTrailing,
  CommentAlike,
  KeyWord,
  ParentheseLeft,
  ParentheseRight,
  SpaceMaybe,
  SpaceMust,
  SymbolName,
  SyntaxToken,
} from "./keyword";
import {
  ParentNode,
  ParseState,
  WithDataReference,
  SyntaxNode,
} from "./syntax_node";

// abstract class SyntaxNodeNested<T extends SyntaxNode = SyntaxNode> {
//   abstract children: T[];
// }

namespace ArgumentsNode {
  class _node extends ParentNode {
    children: Argument[] = [];
    parse(parser: ParseState<SyntaxNode>): boolean {
      let success = true;
      for (const child of this.children) {
      }
      return success;
    }
  }

  export const isCareFor = (line?: string) => {
    return new _node();
  };
}

class _DefineData {
  args: string[] = [];
  indent: number = 0;
}

type DefineData = _DefineData | undefined;

namespace DefineGuardNode {
  class _node extends ParentNode implements WithDataReference<DefineData> {
    children: SyntaxToken[] = [
      new SpaceMaybe(),
      new CommentAlike(),
      new KeyWord(),
      new SpaceMust(),
      new SymbolName(),
      new ParentheseLeft(),
      new Argument(),
      new ParentheseRight(),
      new DefineTrailing(),
      new CommentAlike(),
    ];
    impl_ref: DefineData;

    parse(parser: ParseState<SyntaxNode>): boolean {
      let success = true;

      for (const child of this.children) {
        success = child.parse(parser);
        if (!success) {
          return success;
        }
      }
      const line = parser.currLine;
      const consumed = parser.impl_ref.charNumber;
      if (line.length >= consumed) {
        this.children.at(-1)!.content = line.substring(consumed);
      }
      parser.impl_ref.lastIndicisive = null;
      parser.currLine = undefined;
      this.isClosed = true;
      return success;
    }
  }

  /**
   * create for node when line contain cared syntax
   * and this one is care free actrually
   * @param line
   * @returns
   */
  export const isCareFor = (line?: string) => {
    return new _node();
  };
}

namespace DefineBodyNode {
  class _node extends ParentNode implements WithDataReference<DefineData> {
    children: SyntaxToken[] = [];
    impl_ref: DefineData;
    parse(parser: ParseState<SyntaxNode>): boolean {
      return true;
    }
  }

  export const isCareFor = (line?: string) => {
    return new _node();
  };
}

namespace DefineNode {
  class _node extends ParentNode implements WithDataReference<DefineData> {
    children = [DefineGuardNode.isCareFor(), DefineGuardNode.isCareFor()];
    impl_ref: DefineData = new _DefineData();

    parse(parser: ParseState<SyntaxNode>): boolean {
      let success = true;
      for (const child of this.children) {
        child.impl_ref = this.impl_ref;
        success = child.parse(parser);
        if (!success) {
          break;
        }
      }
      return true;
    }
  }

  export const isCareFor = (line: string): _node | undefined => {
    const kwIndex = KeyWord.matcher.indexIn(line);

    if (kwIndex < 0) {
      return undefined;
    } else {
      return new _node();
    }
  };
}

namespace DocumentCommentNode {
  class _node extends ParentNode {
    children: CommentAlike[] = [new CommentAlike()];
    lines: number = 0;
    length: number = 0;

    parse(parser: ParseState<SyntaxNode>): boolean {
      while (!parser.EOF()) {
        const line = parser.currLine;
        const kwIndex = KeyWord.matcher.indexIn(line);
        if (kwIndex < 0) {
          // no keyword found
          this.lines += 1;
          this.length += line.length;
          // this.children[0].storage += line;

          // consume line
          parser.currLine = undefined;
        } else {
          // close self return control to parent
          this.isClosed = true;
          break;
        }
      }
      return true;
    }
  }

  export const isCareFor = (line: string): _node | undefined => {
    if (false) {
      return undefined;
    } else {
      return new _node();
    }
  };
}

class RootNode extends ParentNode {
  children: ParentNode[] = [];
  get lastChild(): SyntaxNode | undefined {
    let child = this.children.at(-1);
    if (!child || child.isClosed) {
      child = undefined;
    }
    return child;
  }

  newChild = (line: string) => {
    let child: SyntaxNode | undefined;
    if (false) {
    } else if ((child = DefineNode.isCareFor(line))) {
    } else if ((child = DocumentCommentNode.isCareFor(line))) {
    }
    return child;
  };

  parse = (parser: ParseState<SyntaxNode>): boolean => {
    while (!parser.EOF()) {
      const line = parser.currLine;
      const child = this.lastChild;
      if (!child) {
        let childNew = this.newChild(line);
        if (!childNew) {
          throw new SyntaxError("unrecognized synatx");
        }
        continue;
      } else {
        child.parse(parser);
      }
    }
    return true;
  };
}
