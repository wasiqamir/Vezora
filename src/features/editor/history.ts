const HISTORY_LIMIT = 80;

export type HistoryEntry = {
  document: string;
  selection: string[];
};

export class EditHistory {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private presentDocument: string;
  private presentSelection: string[] = [];

  constructor(document: string) {
    this.presentDocument = document;
  }

  push(document: string, selection: string[]) {
    if (document === this.presentDocument) {
      this.presentSelection = selection;
      return false;
    }
    this.past.push({ document: this.presentDocument, selection: this.presentSelection });
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.presentDocument = document;
    this.presentSelection = selection;
    this.future = [];
    return true;
  }

  setSelection(selection: string[]) {
    this.presentSelection = selection;
  }

  reset(document: string) {
    this.past = [];
    this.future = [];
    this.presentDocument = document;
    this.presentSelection = [];
  }

  undo(): HistoryEntry | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push({ document: this.presentDocument, selection: this.presentSelection });
    this.presentDocument = previous.document;
    this.presentSelection = previous.selection;
    return previous;
  }

  redo(): HistoryEntry | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({ document: this.presentDocument, selection: this.presentSelection });
    this.presentDocument = next.document;
    this.presentSelection = next.selection;
    return next;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
