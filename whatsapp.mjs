import { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason } from '@whiskeysockets/baileys';
import fs from 'fs';
import pino from 'pino';
import readline from 'readline';
import chalk from 'chalk';
import dns from 'dns/promises';

// === Animated Banner ===
console.clear();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise(resolve => rl.question(text, resolve));

const bannerLines = [
  "      ___           ___           ___           ___           ___           ___     ",
  "     /\\  \\         |\\__\\         /\\  \\         /\\__\\         /\\  \\         /\\__\\    ",
  "    /::\\  \\        |:|  |       /::\\  \\       /::|  |       /::\\  \\       /:/  /    ",
  "   /:/\\:\\  \\       |:|  |      /:/\\:\\  \\     /:|:|  |      /:/\\ \\  \\     /:/__/     ",
  "  /::\\~\\:\\  \\      |:|__|__   /::\\~\\:\\  \\   /:/|:|  |__   _\\:\\~\\ \\  \\   /::\\  \\ ___ ",
  " /:/\\:\\ \\:\\__\\     /::::\\__\\ /:/\\:\\ \\:\\__\\ /:/ |:| /\\__\\ /\\ \\:\\ \\:\\__\\ /:/\\:\\  /\\__\\",
  " \\/__\\:\\/:/  /    /:/~~/~    \\/__\\:\\/:/  / \\/__|:|/:/  / \\:\\ \\:\\ \\/__/ \\/__\\:\\/:/  /",
  "      \\::/  /    /:/  /           \\::/  /      |:/:/  /   \\:\\ \\:\\__\\        \\::/  / ",
  "      /:/  /     \\/__/            /:/  /       |::/  /     \\:\\/:/  /        /:/  /  ",
  "     /:/  /                      /:/  /        /:/  /       \\::/  /        /:/  /   ",
  "     \\/__/                       \\/__/         \\/__/         \\/__/         \\/__/    ",
  "",
  "╔═════════════════════ WhaTsApp Tool ═════════════════════╗",
  "║             𝗩𝟵𝗠𝗣𝗜𝗥𝟯 𝗥𝗨𝗟𝟯𝗫 𝗢𝗪𝗡𝟯𝗥 𝟵𝗬𝟵𝗡𝗦𝗛 𝗛𝟯𝗥𝟯 🩵              ║",
  "╚════════════════════════════════════════════════════════╝",
  "Author     : AY9NSH H3R3",
  "Tool Name  : WhatsApp Auto Messenger",
  "────────────────────────────────────────────────────────────",
  "𖣘︎𖣘︎𖣘︎︻╦デ╤━╼【★ AY9NSH TOOL OWNER ★】╾━╤デ╦︻𖣘︎𖣘︎𖣘︎",
  "────────────────────────────────────────────────────────────",
  "【𝐅𝐄𝐄𝐋 𝐓𝐇𝐄 𝐏𝐎𝗪𝐄𝐑 𝗢𝐅 𝗩𝟗𝗠𝗣𝗜𝐑𝟯 𝗥𝗨𝗟𝟯𝗫 𝗢𝗪𝗡𝟯𝗥 𝗔𝗬𝟗𝗡𝗦𝗛】",
  "       𖣘︎𖣘︎𖣘︎【 AY9NSH INSIDE 】𖣘︎𖣘︎𖣘︎",
  "────────────────────────────────────────────────────────────"
];

for (const line of bannerLines) {
  await new Promise(res => setTimeout(res, 50));
  console.log(chalk.hex('#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'))(line));
}

// === Global Variables ===
let target, targetName, intervalTime, messages = [], msgIndex = 0;
let sock = null;

// === File Reader ===
const readMessagesFromFiles = async (filePaths) => {
  let messages = [];
  for (const filePath of filePaths) {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      messages = messages.concat(data.split('\n').filter(line => line.trim() !== ''));
    } catch (err) {
      console.error(`\n[!] Error reading message file: ${filePath}\n`, err);
      process.exit(1);
    }
  }
  return messages;
};

// === Internet Check ===
const waitForInternet = async () => {
  while (true) {
    try {
      await dns.lookup('google.com');
      return true;
    } catch {
      console.log(chalk.red("[!] Internet disconnected. Retrying in 60 sec..."));
      await new Promise(res => setTimeout(res, 60000));
    }
  }
};

// === Message Sender Loop ===
const sendMessageLoop = async () => {
  while (true) {
    try {
      await waitForInternet();
      const raw = messages[msgIndex];
      const fullMsg = `${targetName} ${raw}`;
      const time = new Date().toLocaleTimeString();

      if (/^\d+$/.test(target)) {
        await sock.sendMessage(`${target}@s.whatsapp.net`, { text: fullMsg });
      } else {
        await sock.sendMessage(target, { text: fullMsg });
      }

      console.log(chalk.hex('#9B30FF')(`
╔═════════════════════════════════════════════════╗
║            🧛‍♂️ MESSAGE SENT LOG [VR TOOL]           ║
╠═════════════════════════════════════════════════╣
║ 🕒 Time       : ${time}
║ 🎯 Target     : ${targetName}
║ 📞 Number/UID : ${target}
║ 💬 Message    : ${raw}
╠═════════════════════════════════════════════════╣
║ ✅ Status     : Delivered Successfully
╚═════════════════════════════════════════════════╝
        ⚔️ Sent by Vampire Rulex Tool ⚔️
`));

      msgIndex = (msgIndex + 1) % messages.length;
      await new Promise(res => setTimeout(res, intervalTime * 1000));
    } catch (err) {
      console.log(chalk.red(`[x] Send error: ${err.message || err}. Retrying in 60 sec...`));
      await new Promise(res => setTimeout(res, 60000));
    }
  }
};

// === WhatsApp Socket ===
const connect = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('./session');

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
    },
    markOnlineOnConnect: true,
  });

  if (!sock.authState.creds.registered) {
    let phoneNumber = await question(chalk.greenBright(`ENTER COUNTRY CODE + PHONE NUMBER: `));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    if (!phoneNumber.startsWith('91')) {
      console.log(chalk.redBright("Please include country code, e.g., +91"));
      process.exit(1);
    }

    setTimeout(async () => {
      let code = await sock.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(chalk.green(`THIS IS YOUR LOGIN CODE: ${code}`));
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(chalk.yellowBright("✅ WhatsApp Login Successful"));

      const groupMetadata = await sock.groupFetchAllParticipating();
      const groupList = Object.values(groupMetadata);

      console.log(chalk.green("\nYour Group List:"));
      groupList.forEach((group, i) => {
        console.log(`${i + 1}. Name: ${group.subject}, UID: ${group.id}`);
      });

      if (!target || !targetName || messages.length === 0) {
        target = await question("\nEnter Target Phone Number OR Group UID: ");
        targetName = await question("Enter Target Name (for labeling): ");
        intervalTime = parseInt(await question("Enter interval time in seconds: ")) || 60;
        const filePathsInput = await question("Enter message file names (comma-separated): ");
        const filePaths = filePathsInput.split(',').map(file => file.trim());
        messages = await readMessagesFromFiles(filePaths);

        if (messages.length === 0) {
          console.log("[!] No messages found in specified files.");
          process.exit(1);
        }
      }

      await sendMessageLoop();
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log(chalk.red(`[!] Disconnected. Reconnecting after checking internet...`));
        await waitForInternet();
        await connect();
      } else {
        console.log("[x] Session ended or user logged out.");
      }
    }
  });
};

// === Start the bot ===
connect();
