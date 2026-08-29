type ShellBackHandler = () => boolean;

let handler: ShellBackHandler | null = null;

/** CRM / nested shells register a handler so Android back pops UI instead of exiting. */
export function setAndroidShellBackHandler(next: ShellBackHandler | null) {
  handler = next;
}

export function handleAndroidShellBack(): boolean {
  return handler ? handler() : false;
}
