export const countWords = (text = "") => {
  const t = text.trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
};