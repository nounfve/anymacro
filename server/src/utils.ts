import { dirname } from "path";
import { Diagnostic, Position, Range, TextEdit } from "vscode-languageserver";
import { FileExtRegex } from "./constants";
import { TextDocument } from "vscode-languageserver-textdocument";

const rational_shift_spliter = 10;
export const postionToNumber = (pos: Position) => {
  return (pos.line << rational_shift_spliter) + pos.character;
};

export const rangeContain = (outer: Range, inner: Range) => {
  return (
    postionToNumber(outer.start) <= postionToNumber(inner.start) &&
    postionToNumber(outer.end) >= postionToNumber(inner.end)
  );
};

export const rangeFullLine = (from: Range) => {
  return Range.create(
    Position.create(from.start.line, 0),
    Position.create(from.end.line + 1, 0)
  );
};

export const diagnosticEqual = (one: Diagnostic, other: Diagnostic) => {
  return (
    one.data === other.data &&
    postionToNumber(one.range.start) === postionToNumber(other.range.start) &&
    postionToNumber(one.range.end) === postionToNumber(other.range.end)
  );
};

export type Optional<T extends { [key: string]: any }> = {
  [key in keyof T]: T[key] | undefined;
};

const lastdotRegex = /\.(.+)$/;
export const pathInjectAnymacroExtension = (path: string) => {
  return path
    .replaceAll(".anymacro.", ".")
    .replace(lastdotRegex, ".anymacro.$1");
};

export const findLastExtension = (path: string) => {
  return path.match(lastdotRegex)![0];
};

const indentRegex = /^([\t ]+)?/;
export const findIndent = (line: string) => {
  const match = line.match(indentRegex);
  return !!match ? match[0] : "";
};

const lineWithOptionalCommentStarterRegex = /^(\s{0,})(\/\/)? ?(.{0,})$/;
export const textEditCommentAndAppend = (
  line: string,
  tail: string,
  position: Position,
  commentPromt: string = ""
) => {
  const newText =
    line.replace(lineWithOptionalCommentStarterRegex, `$1${commentPromt}$3`) +
    tail;
  return TextEdit.replace(
    Range.create(Position.create(position.line, 0), position),
    newText
  );
};

export const determineCommentPromt = (fileExtension: string = "") => {
  fileExtension = fileExtension.toLocaleLowerCase();
  let commentPromt =
    fileExtension === ".dockerfile" || fileExtension === ".py" ? "#" : "//";
  return commentPromt + " ";
};

export const overlapSearch = (head: string, tail: string) => {
  let head2: string;
  let tail2: string;
  if (head.length > tail.length) {
    head2 = head.substring(head.length - tail.length);
    tail2 = tail;
  } else {
    head2 = head;
    tail2 = tail.substring(0, head.length);
  }
  const sameSize = head2.length;

  const tailFirt = tail.at(0)!;
  let headOffset = 0;
  while ((headOffset = head2.indexOf(tailFirt, headOffset)) >= 0) {
    const headToEnd = head2.substring(headOffset);
    const tailFromStart = tail2.slice(0, sameSize - headOffset);
    if (headToEnd.localeCompare(tailFromStart) === 0) {
      return headToEnd;
    }
    headOffset++;
  }
  return "";
};

export const removeTrailingNextline = (str: string) => {
  return str.at(-1) === "\n" ? str.slice(0, -1) : str;
};

export function* parentPathGenerator(path: string, indexFileName: string) {
  yield path;
  let next = dirname(path);
  while (next.length > 10) {
    yield `${next}/${indexFileName}`;
    next = dirname(next);
  }
  return;
}

export async function busyWait(test: () => boolean) {
  const delayMs = 200;
  while (!test()) await new Promise((resolve) => setTimeout(resolve, delayMs));
}
