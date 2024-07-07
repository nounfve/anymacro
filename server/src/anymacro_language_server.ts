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
import { rangeContain } from "./utils";
import { connectionType } from "./server";
import { FileExtRegex, MaxProblems } from "./constants";
import {
  CodeActionMap as CodeActionManager,
  CodeActionWithDiagnostic,
} from "./code_action_manager";
import { MacroTokenGroups as AnymacroTokenGroups } from "./anymacro_token_groups";
import { AnyMacroFileTracker } from "./anymacro_file_tracker";

export abstract class LanguageServer extends Object {
  [key: string]: any;
  constructor() {
    super();
  }

  static registerKey = "_commands";
  static register = (nickname?: string) => {
    return (target: LanguageServer, key: string) => {
      if (!target.hasOwnProperty(LanguageServer.registerKey)) {
        Object.defineProperty(target, LanguageServer.registerKey, {
          value: new Map<string, string>(),
          writable: true,
        });
      }
      nickname || (nickname = key);
      target.commands.set(nickname, key);
    };
  };

  get commands() {
    return (this as any)[LanguageServer.registerKey] as Map<string, string>;
  }
}

export class AnymacroLanguageServer extends LanguageServer {
  connection: connectionType;
  documents: TextDocuments<TextDocument>;
  codeActionManager: CodeActionManager;
  fileTracker: AnyMacroFileTracker;
  constructor(connectionRef: connectionType) {
    super();
    this.connection = connectionRef;
    this.documents = new TextDocuments(TextDocument);
    this.codeActionManager = new CodeActionManager();
    this.fileTracker = new AnyMacroFileTracker();
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
    const actions = this.codeActionManager
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
    const methodName = this.commands.get(params.command);
    const method = (methodName && this[methodName]) as Function | undefined;
    if (!method) {
      return;
    }
    method(...params.arguments!);
  };

  @AnymacroLanguageServer.register("to lower case")
  to_lower_case = (uri?: string, identity?: string) => {
    if (uri === undefined || identity === undefined) {
      return;
    }

    const textDocument = this.documents.get(uri);
    if (textDocument === undefined) {
      return;
    }

    const action = this.codeActionManager
      .getDocument(textDocument.uri)
      .find((value) => {
        return value.diagnostic.data === identity;
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

  @AnymacroLanguageServer.register("trigger macro")
  trigger_macro = (uri?: string, identity?: string) => {
    console.log("trigger macro");
  };

  validateAnymacroFile = async (textDocument: TextDocument) => {
    const actions = this.codeActionManager.getDocument(textDocument.uri);
    actions.splice(0, actions.length);

    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    let problems = 0;

    const allCaps = /\b[A-Z]{2,}\b/g;

    let match: RegExpExecArray | null;
    while ((match = allCaps.exec(text)) && problems < MaxProblems) {
      problems++;
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: textDocument.positionAt(match.index),
          end: textDocument.positionAt(match.index + match[0].length),
        },
        message: `${match[0]} is all uppercase.`,
        source: "anymacro",
        data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
      };
      diagnostics.push(diagnostic);

      const label = "to lower case";
      actions.push({
        diagnostic: diagnostic,
        action: CodeAction.create(
          label,
          Command.create(label, label, textDocument.uri, diagnostic.data),
          CodeActionKind.QuickFix
        ),
      });
    }

    const foundMacros = this.fileTracker.parseAnymacroDocument(
      textDocument.uri,
      text
    );

    foundMacros.forEach((value, key) => {
      this._temp_show_symbol(value.start, textDocument, diagnostics);
      this._temp_show_symbol(value.end, textDocument, diagnostics);
    });

    return diagnostics;
  };

  validateCallingFile = async (textDocument: TextDocument) => {
    const actions = this.codeActionManager.getDocument(textDocument.uri);
    actions.splice(0, actions.length);

    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];

    const foundMacros = this.fileTracker.parseContent(text);
    Object.entries(foundMacros).forEach(([key, value]) => {
      const ic = value.end ? "" : "<called here>";
      this._temp_show_symbol(
        value.start!,
        textDocument,
        diagnostics,
        actions,
        ic
      );
      !ic && this._temp_show_symbol(value.end!, textDocument, diagnostics);
    });

    return diagnostics;
  };

  validateTextDocument = async (
    textDocument: TextDocument
  ): Promise<Diagnostic[]> => {
    const fileExtMatch = textDocument.uri.match(FileExtRegex);
    if (fileExtMatch !== null) {
      return this.validateAnymacroFile(textDocument);
    } else {
      return this.validateCallingFile(textDocument);
    }
  };

  _temp_show_symbol = (
    groups: AnymacroTokenGroups,
    textDocument: TextDocument,
    diagnostics: Diagnostic[],
    actions?: CodeActionWithDiagnostic[],
    isCalling: string = ""
  ) => {
    if (groups.symbol) {
      const startPos = textDocument.positionAt(groups.offSetStart("symbol"));
      const endPos = textDocument.positionAt(groups.offsetEnd("symbol"));
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `${groups.symbol} is symbol.${isCalling}`,
        source: "anymacro",
        data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
      };

      const label = "trigger macro";
      diagnostics.push(diagnostic);
      isCalling &&
        actions?.push({
          diagnostic: diagnostic,
          action: CodeAction.create(
            label,
            Command.create(label, label, textDocument.uri, diagnostic.data),
            CodeActionKind.QuickFix
          ),
        });
    }

    if (groups.args) {
      const startPos = textDocument.positionAt(groups.offSetStart("args"));
      const endPos = textDocument.positionAt(groups.offsetEnd("args"));
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `${groups.args} is args.`,
        source: "anymacro",
        data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
      };
      diagnostics.push(diagnostic);
    }
  };
}
