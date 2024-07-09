import { readFile } from "fs/promises";
import {
  TextDocuments,
  TextDocumentsConfiguration,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

export class TextDocumentsEx<T extends TextDocument> extends TextDocuments<T> {
  _map_extra: Map<string, T>;
  constructor(configuration: TextDocumentsConfiguration<T>) {
    super(configuration);
    this._map_extra = new Map();
  }

  get(uri: string): T | undefined {
    return this._map_extra.get(uri) || super.get(uri);
  }

  async create(filePath: string): Promise<void> {
    const uri = URI.file(filePath).toString();
    const content = await readFile(filePath, { encoding: "utf-8" });
    this._map_extra.set(
      uri,
      TextDocument.create(uri, ".anymacro", -1, content) as T
    );
  }
}
