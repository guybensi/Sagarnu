export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend de-duplicates sends with the same key for 24h. */
  idempotencyKey?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    return (await res.json()) as { id: string };
  }
}

/** Development fallback: prints the email (including links) instead of sending it. */
export class ConsoleEmailProvider implements EmailProvider {
  constructor(private readonly log: (line: string) => void = console.log) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    this.log(`\n✉️  to: ${message.to}\n   subject: ${message.subject}\n${message.text}\n`);
    return { id: `console-${Date.now()}` };
  }
}

export function createEmailProvider(opts: { resendApiKey?: string; from?: string }): EmailProvider {
  return opts.resendApiKey && opts.from
    ? new ResendEmailProvider(opts.resendApiKey, opts.from)
    : new ConsoleEmailProvider();
}
