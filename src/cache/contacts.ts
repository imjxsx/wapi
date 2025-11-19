interface IContact {
  jid: string;
  pn: string;
  name: string;
}
export const contacts = new Map<string, IContact>();