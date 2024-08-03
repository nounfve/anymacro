import { CodeAction, Diagnostic } from "vscode-languageserver";
import { Range } from 'vscode-languageserver-textdocument';

export type MacroPath = {
  fileName: string;
  symbolName: string;
  arguments: string;
  range?:Range;
};

export type CodeActionWithDiagnostic = {
  diagnostic: Diagnostic;
  action: CodeAction;
  macroPath: MacroPath;
};

export class CodeActionMap extends Map<
  string,
  Array<CodeActionWithDiagnostic>
> {
  unique: number;
  constructor() {
    super();
    this.unique = 0;
  }

  getUnique = () => {
    if (this.unique > Number.MAX_SAFE_INTEGER) {
      this.unique = 0;
    }
    return this.unique++;
  };

  getDocument = (path: string) => {
    let array = this.get(path);
    if (!array) {
      array = new Array();
      this.set(path, array);
    }
    return array!;
  };
}
