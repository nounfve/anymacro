import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeWatchedFilesParams,
  ExecuteCommandParams,
  InitializeParams,
  Position,
  Range,
  TextDocumentEdit,
  TextDocumentPositionParams,
  TextEdit,
  WorkspaceFolder,
} from "vscode-languageserver";
import { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import {
  findIndent,
  findLastExtension,
  overlapSearch,
  parentPathGenerator,
  pathInjectAnymacroExtension,
  rangeContain,
  rangeFullLine,
  removeTrailingNextline,
  textEditCommentAndAppend,
} from "./utils";
import { connectionType } from "./server";
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
import { DefineTagNode, Macrobody } from "./anymacro2/parser";
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
  codeActionManager2: CodeActionManager;
  fileTracker: AnyMacroFileTracker;
  workspaceFolders: WorkspaceFolder[];
  constructor(connectionRef: connectionType) {
    super();
    this.connection = connectionRef;
    this.documents = new TextDocumentsEx(TextDocument);
    this.codeActionManager = new CodeActionManager();
    this.codeActionManager2 = new CodeActionManager();
    this.fileTracker = new AnyMacroFileTracker();
    this.workspaceFolders = [];
  }

  listen = async () => {
    this.connection.onCodeAction(this.onCodeAction);
    this.connection.onExecuteCommand(this.onExecuteCommand);
    this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles);
    this.connection.onCompletion(this.onCompletion);
    this.connection.onCompletionResolve(this.onCompletionResolve);

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
    const actions = this.codeActionManager
      .getDocument(params.textDocument.uri)
      .filter((value) => {
        return (
          !!value.diagnostic &&
          rangeContain(value.diagnostic.range, params.range)
        );
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

    const action =
      this.codeActionManager.getDocument(textDocument.uri).find((value) => {
        return value.diagnostic.data === identity;
      }) ||
      this.codeActionManager2.getDocument(textDocument.uri).find((value) => {
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

  onCompletion = (params: TextDocumentPositionParams): CompletionItem[] => {
    const completion: CompletionItem[] = [];
    const textDocument = this.documents.get(params.textDocument.uri);
    if (!textDocument) {
      return completion;
    }
    const actions = this.codeActionManager2.getDocument(textDocument!.uri!);
    const lineRange = rangeFullLine(
      Range.create(params.position, params.position)
    );
    const line = removeTrailingNextline(textDocument.getText(lineRange));

    const anymacroOverlap = overlapSearch(line, "@anyMacro");
    if (anymacroOverlap.length > 0 || true) {
      const label = "post-insert keyword";
      const unique = `${
        textDocument.version
      }:${this.codeActionManager.getUnique()}`;
      const command = Command.create(
        `${label}`,
        label,
        textDocument.uri,
        unique
      );
      const textEdit = textEditCommentAndAppend(
        line.substring(0, line.length - anymacroOverlap.length),
        "@anyMacro",
        params.position
      );
      actions.slice(0, actions.length);
      actions.push({
        diagnostic: { range: textEdit.range, message: "", data: unique },
        action: CodeAction.create(label, command, CodeActionKind.Empty),
        macroPath: {
          fileName: undefined as any,
          symbolName: undefined as any,
          arguments: undefined as any,
        },
      });

      completion.push({
        label: "anyMacro",
        insertText: "anyMacro",
        kind: CompletionItemKind.Keyword,
        command: command,
      });
    }

    return completion;
  };

  onCompletionResolve = (item: CompletionItem): CompletionItem => {
    switch (item.label) {
      case "anymacro":
        item.detail = "anymacro details";
        item.documentation = "anymacro documentation";
    }
    return item;
  };

  onDecoratorRequest = (request: DecoratorRequest) => {
    const found = this.fileTracker.getDocument(request.fileName);
    const textDocument = this.documents.get(request.fileName);
    const response: DecoratorResponse = DecoratorResponse.blank();
    if (textDocument !== undefined) {
      AnyMacroFileTracker.macroGenerateDecorator(
        found,
        response,
        textDocument!
      );
    }
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

  @AnymacroLanguageServer.register("expand macro")
  trigger_macro = (
    textDocument: TextDocument,
    action: CodeActionWithDiagnostic
  ) => {
    const macroFile = this.documents.get(action.macroPath.fileName);
    const macro = this.fileTracker
      .getDocument(action.macroPath.fileName)
      .getSymbol(action.macroPath.symbolName);
    if (macroFile === undefined || macro === undefined) {
      return;
    }

    const callArguments = action.macroPath.arguments.split(",");

    const callExpressionRange = rangeFullLine(action.diagnostic.range);
    const callExpression = textDocument.getText(callExpressionRange);
    const callIndent = findIndent(callExpression);

    let newText =
      callIndent + callExpression.substring(callIndent.length);
    newText =
      newText +
      // macro[0].outputWith(callArguments, callIndent) +
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

  @AnymacroLanguageServer.register("unexpand macro")
  unexpand_macro = (
    textDocument: TextDocument,
    action: CodeActionWithDiagnostic
  ) => {
    const macroFile = this.documents.get(action.macroPath.fileName);
    const macro = this.fileTracker
      .getDocument(action.macroPath.fileName)
      .getSymbol(action.macroPath.symbolName);
    if (macroFile === undefined || macro === undefined) {
      return;
    }

    const callArguments = action.macroPath.arguments.split(",");

    const callExpressionRange = rangeFullLine(action.diagnostic.range);
    const fullExpansionRange = rangeFullLine(action.macroPath.range!);
    const callExpression = textDocument.getText(callExpressionRange);
    const callIndent = findIndent(callExpression);

    let newText = callIndent + callExpression.substring(callIndent.length);

    this.connection.workspace.applyEdit({
      documentChanges: [
        TextDocumentEdit.create(
          { uri: textDocument.uri, version: textDocument.version },
          [TextEdit.replace(fullExpansionRange, newText)]
        ),
      ],
    });
  };

  @AnymacroLanguageServer.register("post-insert keyword")
  insert_keyword = (
    textDocument: TextDocument,
    action: CodeActionWithDiagnostic
  ) => {
    console.log(action.action.data);
    const lineRange = rangeFullLine(action.diagnostic.range);
    const line = removeTrailingNextline(textDocument.getText(lineRange));
    const anymacroOverlap = overlapSearch(line, "@anyMacro");
    const textEdit = textEditCommentAndAppend(
      line.substring(0, line.length - anymacroOverlap.length),
      "@anyMacro",
      Position.create(lineRange.start.line, line.length)
    );

    this.connection.workspace.applyEdit({
      documentChanges: [
        TextDocumentEdit.create(
          { uri: textDocument.uri, version: textDocument.version },
          [textEdit]
        ),
      ],
    });
  };

  resolveFilePathForSymbol = (
    symbol: string,
    path: string
  ): [string, Macrobody | undefined] => {
    const extension = findLastExtension(path);
    let macroFile: string = "";
    let macro: Macrobody | undefined;
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

      macro = this.fileTracker.getDocument(textDocument.uri).getSymbol(symbol);
      if (!!macro && !macro[0].isCallTag()) {
        macroFile = textDocument.uri;
        break;
      }
    }
    return [macroFile, macro];
  };

  validateAnymacroFile = async (textDocument: TextDocument) => {
    const actions = this.codeActionManager.getDocument(textDocument.uri);
    actions.splice(0, actions.length);

    const diagnostics: Diagnostic[] = [];

    const parser = this.fileTracker.parseAnymacroDocument(textDocument);

    parser.balancer.balanced.forEach((value) => {
      this._temp_show_balanced(value, textDocument, diagnostics, actions);
    });

    parser.balancer.unblanced.forEach((vaule, key) =>
      vaule.forEach((value, key) => {
        this._temp_show_unexpanded(value, textDocument, diagnostics, actions);
      })
    );

    return diagnostics;
  };

  validateTextDocument = async (
    textDocument: TextDocument
  ): Promise<Diagnostic[]> => {
    return this.validateAnymacroFile(textDocument);
  };

  _temp_show_unexpanded = (
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

    if (!node.isCallTag()) {
      return;
    }

    const startPos = textDocument.positionAt(node.keyword.range.start.offset);
    const endPos = textDocument.positionAt(node.callNote.range.end.offset);
    const unique = `${
      textDocument.version
    }:${this.codeActionManager.getUnique()}`;
    const [macroFile, macro] = this.resolveFilePathForSymbol(
      symbolName,
      textDocument.uri
    );

    let diagnostic: Diagnostic | undefined = undefined;

    if (!macro) {
      diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `cant resolve macro <${symbolName}>`,
        source: "anymacro",
        data: unique,
      };
    } else {
      diagnostic = {
        severity: DiagnosticSeverity.Information,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `unexpanded macro <${symbolName}>`,
        source: "anymacro",
        data: unique,
      };

      const label = "expand macro";
      actions?.push({
        diagnostic: diagnostic,
        action: CodeAction.create(
          label,
          Command.create(
            `${label} :${symbolName}`,
            label,
            textDocument.uri,
            diagnostic.data
          ),
          CodeActionKind.QuickFix
        ),
        macroPath: {
          fileName: macroFile,
          symbolName: symbolName,
          arguments: args.join(","),
        },
      });
    }

    diagnostic && diagnostics.push(diagnostic);
  };

  _temp_show_balanced = (
    node: Macrobody,
    textDocument: TextDocument,
    diagnostics: Diagnostic[],
    actions?: CodeActionWithDiagnostic[]
  ) => {
    const head = node[0];
    const body = node[1];
    const symbolName = head.symbol.range.slice(head._content);
    if (!head.isCallTag()) {
      return;
    }

    const startPos = textDocument.positionAt(head.keyword.range.start.offset);
    const endPos = textDocument.positionAt(head.callNote.range.end.offset);
    const unique = `${
      textDocument.version
    }:${this.codeActionManager.getUnique()}`;
    const [macroFile, macro] = this.resolveFilePathForSymbol(
      symbolName,
      textDocument.uri
    );

    let diagnostic: Diagnostic | undefined = undefined;

    if (!macro) {
      diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: startPos,
          end: endPos,
        },
        message: `cant resolve macro <${symbolName}>`,
        source: "anymacro",
        data: unique,
      };
    } else {
      const args = head.getArgsArray();
      const indent = head.indent.range.slice(head._content);
      const expanded = body.body();
      const expandedShould = macro[1].outputWith(args, indent);
      if (expandedShould.localeCompare(expanded) !== 0) {
        diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: startPos,
            end: endPos,
          },
          message: `unmatched expansion <${symbolName}>`,
          source: "anymacro",
          data: unique,
        };
      } else {
        diagnostic = {
          severity: DiagnosticSeverity.Information,
          range: {
            start: startPos,
            end: endPos,
          },
          message: `unexpand macro <${symbolName}>`,
          source: "anymacro",
          data: unique,
        };
      }

      const label = "unexpand macro";
      actions?.push({
        diagnostic: diagnostic,
        action: CodeAction.create(
          label,
          Command.create(
            `${label} :${symbolName}`,
            label,
            textDocument.uri,
            diagnostic.data
          ),
          CodeActionKind.QuickFix
        ),
        macroPath: {
          fileName: macroFile,
          symbolName: symbolName,
          arguments: args.join(","),
          range: {
            start: startPos,
            end: textDocument.positionAt(node[2].end.range.end.offset),
          },
        },
      });
    }

    diagnostic && diagnostics.push(diagnostic);
  };
}
