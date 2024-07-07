/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import { workspace, ExtensionContext, DocumentSelector } from "vscode";

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
  const extensionRegex = /^.+(?<anymacroExt>\.anymacro)(?<originExt>\..+)$/;
  const extensions: { [key: string]: string } = {};
  files
    .map((value) => path.basename(value.path))
    .forEach((value) => {
      const match = value.match(extensionRegex);

      match != null &&
        match.groups.originExt != "" &&
        extensions[match.groups.originExt] === undefined &&
        (extensions[match.groups.originExt] =
          match.groups.anymacroExt + match.groups.originExt);
    });
  return extensions;
};

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
  const fileSelector = Object.entries(extensions)
    .map(([key, value]): DocumentFilter => {
      return { scheme: "file", pattern: `**/*${key}` };
    });

  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: fileSelector,
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
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
}

export function deactivate(): Thenable<void> | undefined {
  console.log('Congratulations, your extension "anymacro" is now deactive!');
  if (!client) {
    return undefined;
  }
  return client.stop();
}
