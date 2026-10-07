// Voice command interception: utterances starting with "Command" are matched
// against this registry and never rendered as transcript text.

export interface VoiceCommand {
  /** Canonical trigger phrase after "command", lowercased. */
  phrase: string;
  /** Aliases for ASR variance (e.g. "command clear" / "command claude"). */
  aliases?: string[];
  run(): void;
}

const registry: VoiceCommand[] = [];

export function registerCommand(cmd: VoiceCommand): void {
  registry.push(cmd);
}

/** Try to run `text` as a command. Returns true if intercepted. */
export function tryRunCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized.startsWith('command')) return false;

  const rest = normalized.slice('command'.length).trim().replace(/[.!?]+$/, '');
  for (const cmd of registry) {
    if (rest === cmd.phrase || cmd.aliases?.includes(rest)) {
      cmd.run();
      return true;
    }
  }
  return false;
}

export function listCommands(): string[] {
  return registry.map((c) => `command ${c.phrase}`);
}
