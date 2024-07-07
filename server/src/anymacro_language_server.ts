import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  Diagnostic,
  DiagnosticSeverity,
  ExecuteCommandParams,
  TextDocumentEdit,
  TextDocuments,
  TextEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { diagnosticEqual, rangeContain } from "./utils";
import { connectionType } from "./server";
import { MaxProblems } from "./constants";
import { CodeActionMap as CodeActionManager } from "./code_action_manager";

export class AnymacroLanguageServer {
  connection: connectionType;
  documents: TextDocuments<TextDocument>;
  codeActionMgr: CodeActionManager;
  constructor(connectionRef: connectionType) {
    this.connection = connectionRef;
    this.documents = new TextDocuments(TextDocument);
    this.codeActionMgr = new CodeActionManager();
    this.initDocument();
  }

  initDocument = () => {
    this.documents.onDidChangeContent((change) => {
      this.validateTextDocument(change.document);
    });

    this.documents.listen(this.connection);
  };

  onCodeAction = (params: CodeActionParams) => {
    const textDocument = this.documents.get(params.textDocument.uri);
    if (textDocument === undefined) {
      return undefined;
    }
    params.range.start;
    const actions = this.codeActionMgr
      .getDocument(params.textDocument.uri)
      .filter((value) => {
        return rangeContain(value.diagnostic.range, params.range);
      })
      .map((value) => {
        return value.action;
      });
    return actions;
  };

  onExecuteCommand = async (params: ExecuteCommandParams) => {
    if (
      params.command !== "to lower case" ||
      params.arguments === undefined ||
      params.arguments.length < 2
    ) {
      return;
    }

    const textDocument = this.documents.get(params.arguments[0]);
    if (textDocument === undefined) {
      return;
    }

    const action = this.codeActionMgr.getDocument(textDocument.uri).find((value) => {
      console.log(value.action.command?.arguments![1]);
      console.log(params.arguments![1]);
      console.log(value.action.command?.arguments![1] === params.arguments![1]);
      return diagnosticEqual(value.diagnostic, params.arguments![1]);
    });
    if (action === undefined) {
      return;
    }

    const newText = textDocument.getText(action.diagnostic.range).toLowerCase();

    this.connection.workspace.applyEdit({
      documentChanges: [
        TextDocumentEdit.create(
          { uri: textDocument.uri, version: textDocument.version },
          [TextEdit.replace(action.diagnostic.range, newText)]
        ),
      ],
    });
  };

  validateTextDocument = async (
    textDocument: TextDocument
  ): Promise<Diagnostic[]> => {
    // In this simple example we get the settings for every validate run.
    const actions = this.codeActionMgr.getDocument(textDocument.uri);
    actions.splice(0, actions.length);

    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();
    const pattern = /\b[A-Z]{2,}\b/g;
    let m: RegExpExecArray | null;

    let problems = 0;
    const diagnostics: Diagnostic[] = [];
    while ((m = pattern.exec(text)) && problems < MaxProblems) {
      problems++;
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(m.index),
          end: textDocument.positionAt(m.index + m[0].length),
        },
        message: `${m[0]} is all uppercase.`,
        source: "ex",
        data: textDocument.version,
      };
      diagnostics.push(diagnostic);

      const label = "to lower case";
      actions.push({
        diagnostic: diagnostic,
        action: CodeAction.create(
          label,
          Command.create(label, label, textDocument.uri, diagnostic),
          CodeActionKind.QuickFix
        ),
      });
    }
    return diagnostics;
  };
}
