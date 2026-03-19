export type Change =
  | {
      kind: "writeFile";
      path: string;
      content: string;
    }
  | {
      kind: "mkdir";
      path: string;
    }
  | {
      kind: "updateJson";
      path: string;
      updater: (current: unknown) => unknown;
    };

