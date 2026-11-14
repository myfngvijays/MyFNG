import net from 'node:net';
import tls from 'node:tls';

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: 'tls' | 'ssl';
  from: string;
  fromName: string;
};

function dotStuff(body: string) {
  return body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

const READING_PORTS: Record<number, string> = {
  143: 'IMAP',
  993: 'IMAP SSL',
  110: 'POP3',
  995: 'POP3 SSL',
};

export async function sendSmtpMail(
  config: SmtpConfig,
  message: { to: string; subject: string; text: string },
): Promise<void> {
  const host = config.host.trim();
  const port = config.port || (config.secure === 'ssl' ? 465 : 587);
  if (READING_PORTS[port]) {
    throw new Error(
      `Port ${port} is for reading mail (${READING_PORTS[port]}), not sending. Use SSL on port 465.`,
    );
  }
  let socket: net.Socket;
  try {
    socket = await openSocket(host, port, config.secure === 'ssl');
  } catch (error: any) {
    const message = String(error?.message || error);
    if (/wrong version number|ssl routines/i.test(message)) {
      throw new Error('Could not open SSL on this port. Use Security SSL and port 465, then save and test again.');
    }
    throw error;
  }
  const reader = createReader(socket);
  try {
    await expectCode(reader, [220]);
    await sendLine(socket, `EHLO myfng.in`);
    await expectCode(reader, [250]);
    if (config.secure !== 'ssl') {
      await sendLine(socket, 'STARTTLS');
      await expectCode(reader, [220]);
      socket.removeAllListeners('data');
      socket.removeAllListeners('error');
      const secureSocket = tls.connect({ socket, servername: host });
      await new Promise<void>((resolve, reject) => {
        secureSocket.once('secureConnect', () => resolve());
        secureSocket.once('error', reject);
      });
      socket.removeAllListeners();
      const secureReader = createReader(secureSocket);
      await sendLine(secureSocket, 'EHLO myfng.in');
      await expectCode(secureReader, [250]);
      await authenticate(secureSocket, secureReader, config.user, config.pass);
      await deliver(secureSocket, secureReader, config, message);
      secureSocket.end();
      return;
    }
    await authenticate(socket, reader, config.user, config.pass);
    await deliver(socket, reader, config, message);
    socket.end();
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

function openSocket(host: string, port: number, implicitTls: boolean) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = implicitTls
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });
    const onReady = () => {
      socket.setTimeout(20000);
      resolve(socket);
    };
    socket.once(implicitTls ? 'secureConnect' : 'connect', onReady);
    socket.once('error', reject);
  });
}

function createReader(socket: net.Socket) {
  let buffer = '';
  const pending: string[] = [];
  let waiting: ((chunk: string) => void) | null = null;
  socket.on('data', (data: string | Buffer) => {
    const chunk = typeof data === 'string' ? data : data.toString('utf8');
    if (waiting) {
      const resume = waiting;
      waiting = null;
      resume(chunk);
      return;
    }
    pending.push(chunk);
  });

  async function takeChunk() {
    if (pending.length) return pending.shift() || '';
    return new Promise<string>((resolve, reject) => {
      waiting = resolve;
      socket.once('error', reject);
    });
  }

  return async function readReply(): Promise<{ code: number; text: string }> {
    while (true) {
      const end = buffer.indexOf('\r\n');
      if (end === -1) {
        buffer += await takeChunk();
        continue;
      }
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (line.startsWith('*') || /IMAP|Dovecot ready/i.test(line)) {
        throw new Error('This port is for reading mail, not sending. Use SSL on port 465.');
      }
      const code = Number(line.slice(0, 3));
      if (!Number.isFinite(code)) {
        throw new Error('This port did not answer as SMTP. Use SSL on port 465.');
      }
      if (line[3] === '-') continue;
      return { code, text: line };
    }
  };
}

async function expectCode(read: () => Promise<{ code: number; text: string }>, codes: number[]) {
  const reply = await read();
  if (!codes.includes(reply.code)) {
    throw new Error(reply.text || `SMTP refused the mailbox (${reply.code})`);
  }
  return reply;
}

function sendLine(socket: net.Socket, line: string) {
  socket.write(`${line}\r\n`);
}

async function authenticate(
  socket: net.Socket,
  read: () => Promise<{ code: number; text: string }>,
  user: string,
  pass: string,
) {
  sendLine(socket, 'AUTH LOGIN');
  await expectCode(read, [334]);
  sendLine(socket, Buffer.from(user).toString('base64'));
  await expectCode(read, [334]);
  sendLine(socket, Buffer.from(pass).toString('base64'));
  await expectCode(read, [235]);
}

async function deliver(
  socket: net.Socket,
  read: () => Promise<{ code: number; text: string }>,
  config: SmtpConfig,
  message: { to: string; subject: string; text: string },
) {
  const fromName = config.fromName.replace(/"/g, '');
  sendLine(socket, `MAIL FROM:<${config.from}>`);
  await expectCode(read, [250]);
  sendLine(socket, `RCPT TO:<${message.to}>`);
  await expectCode(read, [250, 251]);
  sendLine(socket, 'DATA');
  await expectCode(read, [354]);
  const body = [
    `From: "${fromName}" <${config.from}>`,
    `To: <${message.to}>`,
    `Subject: ${message.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    message.text,
  ].join('\r\n');
  socket.write(`${dotStuff(body)}\r\n.\r\n`);
  await expectCode(read, [250]);
  sendLine(socket, 'QUIT');
}
