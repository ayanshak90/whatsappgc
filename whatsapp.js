(async () => {

  try {

    const chalk = (await import("chalk")).default;

    const { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = await import("@whiskeysockets/baileys");

    const fs = await import('fs');

    const pino = await import('pino');

    const axios = (await import("axios")).default;

    const readline = (await import('readline')).createInterface({ input: process.stdin, output: process.stdout });

    const { exec } = await import('child_process');



    const clearScreen = () => {

      process.stdout.write('\x1Bc'); // Clears the screen

    };



    const question = (text) => new Promise((resolve) => readline.question(text, resolve));



    let reconnectAttempts = 0;



    const readMessagesFromFiles = async (filePaths) => {

      let messages = [];

      for (const filePath of filePaths) {

        try {

          const data = await fs.promises.readFile(filePath, 'utf-8');

          messages = messages.concat(data.split('\n').filter(line => line.trim() !== ''));

        } catch (err) {

          console.error(`Error reading message file ${filePath}:`, err);

        }

      }

      return messages;

    };



    const connect = async () => {

      const { state, saveCreds } = await useMultiFileAuthState(`./session`);



      const MznKing = makeWASocket({

        logger: pino.default({ level: 'silent' }),

        auth: {

          creds: state.creds,

          keys: makeCacheableSignalKeyStore(state.keys, pino.default({ level: "fatal" })),

        },

        markOnlineOnConnect: true,

      });



      // Generate pairing code if not registered

      if (!MznKing.authState.creds.registered) {

        let phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`ENTER YOUR COUNTRY CODE + PHONE NUMBER: `)));

        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');



        // Simple country code check instead of PHONENUMBER_MCC

        if (!phoneNumber.startsWith('91')) { // Replace '91' with your country code if needed

          console.log(chalk.bgBlack(chalk.redBright("Please start with your country code, e.g., +91 for India.")));

          process.exit(0);

        }



        // Request pairing code

        setTimeout(async () => {

          let code = await MznKing.requestPairingCode(phoneNumber);

          code = code?.match(/.{1,4}/g)?.join("-") || code;

          console.log(chalk.black(chalk.bgGreen(`THIS IS YOUR LOGIN CODE: `)), chalk.black(chalk.cyan(code)));

        }, 3000);

      }



      MznKing.ev.on("connection.update", async (s) => {

        const { connection, lastDisconnect } = s;

        if (connection === "open") {

          console.log(chalk.yellow("Your WhatsApp Login Successfully"));

          reconnectAttempts = 0;



          const groupMetadata = await MznKing.groupFetchAllParticipating();

          const groupEntries = Object.values(groupMetadata);



          console.log(chalk.green("List of group names and UIDs:"));

          groupEntries.forEach((group, index) => {

            console.log(chalk.cyan(`Group ${index + 1}: Name = "${group.subject}", UID = ${group.id}`));

          });



          const target = await question(chalk.bgBlack(chalk.greenBright(`Please type the target phone number or group UID: `)));

          const targetName = await question(chalk.bgBlack(chalk.greenBright(`Please type the target name: `)));

          const intervalTime = await question(chalk.bgBlack(chalk.greenBright(`Please type the interval time in seconds: `)));



          const filePathsInput = await question(chalk.bgBlack(chalk.greenBright(`Please enter the message file names (comma-separated): `)));

          const filePaths = filePathsInput.split(',').map(file => file.trim());



          const messages = await readMessagesFromFiles(filePaths);



          if (messages.length === 0) {

            console.log(chalk.bgBlack(chalk.redBright("No messages found in the specified files.")));

            process.exit(0);

          }



          const colors = [

            chalk.green, chalk.yellow, chalk.white

          ];



          let colorIndex = 0;

          let currentIndex = 0;



          const sendMessageInfinite = async () => {

            try {

              const rawMessage = messages[currentIndex];

              const time = new Date().toLocaleTimeString();



              const simpleMessage = `${targetName} ${rawMessage}`;



              const formattedMessage = `

=======================================

Time ==> ${time}

Target name ==> ${targetName}

Target No ==> ${target}

Message ==> ${rawMessage}

=======================================

              `;



              if (/^\d+$/.test(target)) {

                await MznKing.sendMessage(target + '@s.whatsapp.net', { text: simpleMessage });

              } else {

                await MznKing.sendMessage(target, { text: simpleMessage });

              }



              const messageColor = colors[colorIndex];

              console.log(messageColor(`Message sent successfully:\n${formattedMessage}`));



              colorIndex = (colorIndex + 1) % colors.length;

              currentIndex = (currentIndex + 1) % messages.length;

              setTimeout(sendMessageInfinite, intervalTime * 1000);

            } catch (error) {

              console.error(`Error sending message: ${error}`);

              setTimeout(sendMessageInfinite, intervalTime * 1000);

            }

          };



          MznKing.ev.on('messages.upsert', async (msg) => {

            if (msg.type === 'notify') {

              const incomingMsg = msg.messages[0];

              const timeReceived = new Date(incomingMsg.timestamp * 1000).toLocaleTimeString();

              const incomingText = incomingMsg.message?.conversation || incomingMsg.message?.extendedTextMessage?.text;



              if (incomingText) {

                console.log(chalk.blue(`

=============== your haters details ========================

Your haters message ðŸ‘‡ðŸ‘‡

___________________________________

Message ==> ${incomingText}

=============================================================

                `));

              }

            }

          });



          sendMessageInfinite();

        }



        if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {

          reconnectAttempts++;

          const delay = Math.min(5 * 1000, reconnectAttempts * 1000);

          console.log(`Connection closed, attempting to reconnect in ${delay / 1000} seconds...`);

          setTimeout(connect, delay);

        }

      });



      MznKing.ev.on('creds.update', saveCreds);

    };



    await connect();

  } catch (error) {

    console.error("Error:", error);

  }

})();
