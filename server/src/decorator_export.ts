import { Range } from "vscode-languageserver";

export class DecoratorRequest {
  static Event = "decorator/get";
  fileName: string;
  constructor(filename: string) {
    this.fileName = filename;
  }
}

export interface DecorationOptionsPseudo{
	range:Range
}

export interface DecoratorResponse<T=DecorationOptionsPseudo> {
  keyword: T[];
  symbol: T[];
  argument: T[];
}

export namespace DecoratorResponse {
  export const blank = (): DecoratorResponse => {
    return { keyword: [], symbol: [], argument: [] };
  };
}
