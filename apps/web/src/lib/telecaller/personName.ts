/** First letter of each word capital, rest lower. Works with caps lock on or off. */
export function titleCasePersonName(value: string | null | undefined): string {
  return String(value || '').replace(/[A-Za-z]+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
