import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeWatchedFilesParams,
  ExecuteCommandParams,
  InitializeParams,
  Range,
  TextDocumentEdit,
  TextDocuments,
  TextEdit,
  WorkspaceFolder,
} from "vscode-languageserver";
import { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import {
  findIndent,
  findLastExtension,
  parentPathGenerator,
  pathInjectAnymacroExtension,
  rangeContain,
  rangeFullLine,
} from "./utils";
import { connectionType } from "./server";
import { FileExtRegex, MaxProblems } from "./constants";
import {
  CodeActionMap as CodeActionManager,
  CodeActionWithDiagnostic,
  MacroPath,
} from "./code_action_manager";
import {
  MacroTokenGroups as AnymacroTokenGroups,
  MacroTokenGroups,
} from "./anymacro_token_groups";
import { AnyMacroFileTracker, MacroBody } from "./anymacro_file_tracker";
import { Glob, glob } from "glob";
import { fileURLToPath } from "url";
import { URI } from "vscode-uri";
import { readFile } from "fs/promises";
import { TextDocumentsEx } from "./text_document_ex";

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
  documents: TextDocumentsEx<TextDocument>;
  codeActionManager: CodeActionManager;
  fileTracker: AnyMacroFileTracker;
  workspaceFolders: WorkspaceFolder[];
  constructor(connectionRef: connectionType) {
    super();
    this.connection = connectionRef;
    this.documents = new TextDocumentsEx(TextDocument);
    this.codeActionManager = new CodeActionManager();
    this.fileTracker = new AnyMacroFileTracker();
    this.workspaceFolders = [];
  }

  listen = async () => {
    this.documents.onDidChangeContent((change) => {
      this.validateTextDocument(change.document);
    });

    this.documents.listen(this.connection);
    this.connection.listen();
  };

  onInitialize = async (params: InitializeParams) => {
    this.workspaceFolders = params.workspaceFolders || [];
    for (const folder of this.workspaceFolders) {
      const prefix: string = fileURLToPath(folder.uri);
      const files = await glob("**/*.anymacro.*", {
        cwd: prefix,
      });
      for (const file of files) {
        const filePath = `${prefix}/${file}`;
        await this.documents.create(filePath);
      }
    }
  };

  onInitialized = () => {};

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
    console.log(params.command);
    const methodName = this.commands.get(params.command);
    const method = (methodName && this[methodName]) as Function | undefined;
    if (!method) {
      return;
    }
    const [uri, identity] = params.arguments as string[];
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

    method(textDocument, action);
  };

  onDidChangeWatchedFiles = async (params: DidChangeWatchedFilesParams) => {
    for (const change of params.changes) {
      console.log(this.documents.get(change.uri));
      const textdocument = this.documents.get(change.uri);
      this.fileTracker.parseAnymacroDocument(textdocument!);
    }
  };

  @AnymacroLanguageServer.register("to lower case")
  to_lower_case = (
    textDocument: TextDocument,
    action: CodeActionWithDiagnostic
  ) => {
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
  trigger_macro = (
    textDocument: TextDocument,
    action: CodeActionWithDiagnostic
  ) => {
    const macroFile = this.documents.get(action.macroPath.fileName);
    const macro = this.fileTracker
      .getDocument(action.macroPath.fileName)
      .get(action.macroPath.symbolName);
    if (macroFile === undefined || macro === undefined) {
      return;
    }
    
    const macroExpressionRange_ = Range.create(
      macroFile.positionAt(macro.start.offSetStart("promot")),
      macroFile.positionAt(macro.end.offsetEnd("end"))
    );
    const macroArguments = MacroTokenGroups.findArgs(macro.start.args);
    const callArguments = MacroTokenGroups.findArgs(action.macroPath.arguments);

    const callExpressionRange = rangeFullLine(action.diagnostic.range);
    const callExpression = textDocument.getText(callExpressionRange);
    const callIndent = findIndent(callExpression);

    const macroExpressionRange = rangeFullLine(macroExpressionRange_);
    const macroExpression = macroFile.getText(macroExpressionRange);
    const macroIndent = findIndent(macroExpression);
    
    const macroIndetRegex = new RegExp(String.raw`^${macroIndent}`, "gm");
    const macroExpressionCalled = MacroTokenGroups.replaceArgs(macroExpression,macroArguments,callArguments);
    
    let newText =
      callIndent + "// " + callExpression.substring(callIndent.length);
    newText = newText + macroExpressionCalled.replace(macroIndetRegex, callIndent);

    this.connection.workspace.applyEdit({
      documentChanges: [
        TextDocumentEdit.create(
          { uri: textDocument.uri, version: textDocument.version },
          [TextEdit.replace(callExpressionRange, newText)]
        ),
      ],
    });
  };

  resolveFilePathForSymbol = (symbol: string, path: string) => {
    const extension = findLastExtension(path);
    let macroFile: string = "";
    for (const filename of parentPathGenerator(
      pathInjectAnymacroExtension(path),
      `index.anymacro${extension}`
    )) {
      const textDocument = this.documents.get(filename);
      if (!textDocument) {
        continue;
      }

      if (
        this.fileTracker.version.get(textDocument.uri) !== textDocument.version
      ) {
        this, this.fileTracker.parseAnymacroDocument(textDocument);
      }

      const macro = this.fileTracker.getDocument(textDocument.uri).get(symbol);
      if (!!macro) {
        macroFile = textDocument.uri;
        break;
      }
    }
    return macroFile;
  };

  validateAnymacroFile = async (textDocument: TextDocument) => {
    const actions = this.codeActionManager.getDocument(textDocument.uri);
    actions.splice(0, actions.length);

    const diagnostics: Diagnostic[] = [];

    const foundMacros = this.fileTracker.parseAnymacroDocument(textDocument);

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
        macroPath: [] as unknown as MacroPath,
      });
    }

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

      if (ic === "") {
        this._temp_show_symbol(value.end!, textDocument, diagnostics);
      }
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
        message: `${groups.symbol} is symbol.`,
        source: "anymacro",
        data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
      };
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

    if (isCalling) {
      const startPos = textDocument.positionAt(groups.offSetStart("promot"));
      const endPos = textDocument.positionAt(groups.offsetEnd("end"));
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `${groups.symbol} is ${isCalling}`,
        source: "anymacro",
        data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
      };

      const macroFile = this.resolveFilePathForSymbol(
        groups.symbol,
        textDocument.uri
      );

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
          macroPath: {
            fileName: macroFile,
            symbolName: groups.symbol,
            arguments: groups.args,
          },
        });
    }
  };
}
