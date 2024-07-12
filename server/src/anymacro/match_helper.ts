export interface FindResult {
  match: string | null;
  index: number;
}

export class MatchHelper {
  pattern: RegExp;
  constructor(pattern: RegExp | string) {
    this.pattern = new RegExp(pattern);
  }

  indexIn = (target: string, offset: number = 0): number => {
    return this.findIn(target, offset).index;
  };

  findIn = (target: string, offset: number): FindResult => {
    this.pattern.lastIndex = offset;
    const match = this.pattern.exec(target);
    return {
      match: match ? match[0] : null,
      index: match ? match.index : -1,
    };
  };
}
