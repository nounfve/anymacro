import { CodeAction, Diagnostic } from 'vscode-languageserver';

export type CodeActionWithDiagnostic = {
  diagnostic: Diagnostic;
  action: CodeAction;
};

export class CodeActionMap extends Map<string, Array<CodeActionWithDiagnostic>> {
  constructor() {
    super();
  }

  getDocument = (path: string) => {
    let array = this.get(path);
    if (!array) {
      array = new Array();
      this.set(path, array);
    }
    return array!;
  };
}