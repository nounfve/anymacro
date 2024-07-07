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

export const diagnosticEqual = (one: Diagnostic, other: Diagnostic) => {
  return (
    one.data === other.data &&
    postionToNumber(one.range.start) === postionToNumber(other.range.start) &&
    postionToNumber(one.range.end) === postionToNumber(other.range.end)
  );
};
