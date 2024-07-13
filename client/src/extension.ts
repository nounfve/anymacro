/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  DecoratorRequest,
  DecoratorResponse,
  FileExtRegex,
} from "anymacro-server";
import * as path from "path";
import {
  workspace,
  ExtensionContext,
  window,
  OverviewRulerLane,
  DecorationOptions,
} from "vscode";

import {
  DocumentFilter,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

const SearchForAnyMacroExtension = async () => {
  const files = await workspace.findFiles("**/*.anymacro.*");
  const extensions: { [key: string]: string } = {};
  files
    .map((value) => path.basename(value.path))
    .forEach((value) => {
      const match = value.match(FileExtRegex);

      match != null &&
        match.groups.originExt != "" &&
        extensions[match.groups.originExt] === undefined &&
        (extensions[match.groups.originExt] =
          match.groups.anymacroExt + match.groups.originExt);
    });
  return extensions;
};

async function activeDecorator(context: ExtensionContext) {
  // create a decorator type that we use to decorate small numbers
  const smallNumberDecorationType = window.createTextEditorDecorationType({
    borderWidth: "1px",
    borderStyle: "solid",
    overviewRulerColor: "blue",
    overviewRulerLane: OverviewRulerLane.Right,
    light: {
      // this color will be used in light color themes
      borderColor: "darkblue",
    },
    dark: {
      // this color will be used in dark color themes
      borderColor: "lightblue",
    },
  });

  const symbolDecorationType = window.createTextEditorDecorationType({
    cursor: "crosshair",
    backgroundColor: "#AAAA0055",
  });
  const keywordDecorationType = window.createTextEditorDecorationType({
    cursor: "crosshair",
    backgroundColor: "#AA00AA55",
  });

  async function updateDecorations() {
    if (!activeEditor) {
      return;
    }
    const request = new DecoratorRequest(activeEditor.document.uri.toString());
    const respose = await client.sendRequest<
      DecoratorResponse<DecorationOptions>
    >(DecoratorRequest.Event, request);
    activeEditor.setDecorations(keywordDecorationType, respose.keyword);
    activeEditor.setDecorations(symbolDecorationType, respose.symbol);
    activeEditor.setDecorations(smallNumberDecorationType, respose.argument);
    console.log("???");
  }

  let timeout: NodeJS.Timeout | undefined = undefined;
  async function triggerUpdateDecorations(throttle = false) {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    if (throttle) {
      timeout = setTimeout(updateDecorations, 500);
    } else {
      await updateDecorations();
    }
  }

  let activeEditor = window.activeTextEditor;
  if (activeEditor) {
    await triggerUpdateDecorations();
  }

  window.onDidChangeActiveTextEditor(
    async (editor) => {
      activeEditor = editor;
      if (editor) {
        await triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  workspace.onDidChangeTextDocument(
    async (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        await triggerUpdateDecorations(true);
      }
    },
    null,
    context.subscriptions
  );
}

export async function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "anymacro" is now active!');
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const extensions = await SearchForAnyMacroExtension();
  const fileSelector = Object.entries(extensions).map(
    ([key, value]): DocumentFilter => {
      return { scheme: "file", pattern: `**/*${key}` };
    }
  );

  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: fileSelector,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.anymacro.*"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "languageServerExample",
    "Language Server Example",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  await activeDecorator(context);
}

export function deactivate(): Thenable<void> | undefined {
  console.log('Congratulations, your extension "anymacro" is now deactive!');
  if (!client) {
    return undefined;
  }
  return client.stop();
}
