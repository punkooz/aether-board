export const nowIso = () => new Date().toISOString();

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
