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
import { MacroTokenGroups } from "./anymacro_token_groups";
import { AnyMacroFileTracker } from "./anymacro_file_tracker";
import { Glob, glob } from "glob";
import { fileURLToPath } from "url";
import { TextDocumentsEx } from "./text_document_ex";
import { DefineTagNode } from "./anymacro2/parser";
import { DecoratorRequest, DecoratorResponse } from "./decorator_export";

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
    this.connection.onCodeAction(this.onCodeAction);
    this.connection.onExecuteCommand(this.onExecuteCommand);

    this.documents.onDidChangeContent((change) => {
      this.validateTextDocument(change.document);
    });

    this.connection.onRequest(DecoratorRequest.Event, this.onDecoratorRequest);

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

  onDecoratorRequest = (request: DecoratorRequest) => {
    const found = this.fileTracker.getDocument(request.fileName);
    const textDocument = this.documents.get(request.fileName);
    if (textDocument === undefined) {
      return DecoratorResponse.blank();
    }
    const response: DecoratorResponse =
      AnyMacroFileTracker.macroGenerateDecorator(found, textDocument!);

    return response;
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

    const callArguments = action.macroPath.arguments.split(",");

    const callExpressionRange = rangeFullLine(action.diagnostic.range);
    const callExpression = textDocument.getText(callExpressionRange);
    const callIndent = findIndent(callExpression);

    let newText =
      callIndent + "// " + callExpression.substring(callIndent.length);
    newText =
      newText +
      macro[0].outputWith(callArguments, callIndent) +
      macro[1].outputWith(callArguments, callIndent) +
      macro[2].outputWith(callArguments, callIndent);

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
      this._temp_show_symbol(value[0], textDocument, diagnostics);
      this._temp_show_symbol(value[2], textDocument, diagnostics);
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

    const parser = this.fileTracker.parseContent(text);
    parser.balancer.blanced.forEach(([head, body, tail]) => {
      this._temp_show_symbol(head, textDocument, diagnostics, actions);
      this._temp_show_symbol(tail, textDocument, diagnostics);
    });
    parser.balancer.unblanced.forEach((vaule, key) =>
      vaule.forEach((value, key) => {
        this._temp_show_symbol(value, textDocument, diagnostics, actions);
      })
    );

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
    node: DefineTagNode,
    textDocument: TextDocument,
    diagnostics: Diagnostic[],
    actions?: CodeActionWithDiagnostic[]
  ) => {
    const symbolName = node.symbol.range.slice(node._content);
    // {
    //   const startPos = textDocument.positionAt(node.symbol.range.start.offset);
    //   const endPos = textDocument.positionAt(node.symbol.range.end.offset);
    //   const diagnostic: Diagnostic = {
    //     severity: DiagnosticSeverity.Information,
    //     range: {
    //       start: startPos,
    //       end: endPos,
    //     },
    //     message: `${symbolName} is symbol.`,
    //     source: "anymacro",
    //     data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
    //   };
    //   diagnostics.push(diagnostic);
    // }

    const args = node.getArgsArray();
    // {
    //   const startPos = textDocument.positionAt(
    //     node.args.at(0)!.range.start.offset
    //   );
    //   const endPos = textDocument.positionAt(node.args.at(0)!.range.end.offset);
    //   const diagnostic: Diagnostic = {
    //     severity: DiagnosticSeverity.Information,
    //     range: {
    //       start: startPos,
    //       end: endPos,
    //     },
    //     message: `${args.join("<->")} is args.`,
    //     source: "anymacro",
    //     data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
    //   };
    //   diagnostics.push(diagnostic);
    // }

    if (node.isCallTag()) {
      const startPos = textDocument.positionAt(node.keyword.range.start.offset);
      const endPos = textDocument.positionAt(node.callNote.range.end.offset);
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `${symbolName} is <calling>`,
        source: "anymacro",
        data: `${textDocument.version}:${this.codeActionManager.getUnique()}`,
      };

      const macroFile = this.resolveFilePathForSymbol(
        symbolName,
        textDocument.uri
      );

      const label = "trigger macro: " + symbolName;
      diagnostics.push(diagnostic);

      actions?.push({
        diagnostic: diagnostic,
        action: CodeAction.create(
          label,
          Command.create(label, label, textDocument.uri, diagnostic.data),
          CodeActionKind.SourceOrganizeImports
        ),
        macroPath: {
          fileName: macroFile,
          symbolName: symbolName,
          arguments: args.join(","),
        },
      });
    }
  };
}
