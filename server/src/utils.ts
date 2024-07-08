import { dirname } from "path";
import { Diagnostic, Position, Range } from "vscode-languageserver";

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
  return path.replace(lastdotRegex, ".anymacro.$1");
};

export const findLastExtension = (path: string) => {
  return path.match(lastdotRegex)![0];
};

const indentRegex = /^([\t ]+)?/;
export const findIndent = (line: string) => {
  const match = line.match(indentRegex);
  return !!match ? match[0] : "";
};

export function* parentPathGenerator(path: string, indexFileName: string) {
  yield path;
  let next = dirname(path);
  while (next.length > 10) {
    yield next + indexFileName;
    next = dirname(next);
  }
  return
}
