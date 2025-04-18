import { input, select, confirm } from '@inquirer/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { writeFileSync } from 'fs';

const execCommand = promisify(exec);

async function executeCommand(command: string) {
	try {
		const { stdout, stderr } = await execCommand(command);
		if (stderr) {
			console.error(`Error: ${stderr}`);
		}
		return stdout.trim();
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Execution failed: ${error.message}`);
		} else {
			console.error('Execution failed with an unknown error.');
		}
		throw error;
	}
}

async function hasInternetConnection(): Promise<boolean> {
	try {
		const res = await fetch("https://pluto-freeze.77z.dev", { method: "HEAD" });
		return res.ok;
	} catch {
		return false;
	}
}

async function main() {

	console.log(chalk.green("PlutoOS Installer v0.1.1"));

	process.stdout.write(chalk.bgWhite("checking for internet..."));
	if (!await hasInternetConnection()) {
		console.error(chalk.red("no internet connection, i can't reach 77Z servers!"));
		process.exit(1);
	}

	process.stdout.clearLine(0);
	process.stdout.cursorTo(0);

	console.log(chalk.green("✔ connected to data server!"))

	const feedback = await executeCommand("lsblk --all --raw -d");
	const feedbackSplit = feedback.split("\n");
	
	feedbackSplit.shift();
	
	for (let i = 0; i < feedbackSplit.length; i++) {
		feedbackSplit[i] = feedbackSplit[i].split(" ")[0];
	}
	
	for (let i = 0; i < feedbackSplit.length; i++) {
		if (feedbackSplit[i].startsWith("loop")) {
			feedbackSplit.shift();
			i--;
		}
	}
	
	const driveToPart = await select({
		message: "select drive to partition (not including loopbacks)",
		choices: feedbackSplit,
		loop: false,
	});
	
	const prettyName = await input({ message: 'pretty name of primary user' });
	const internalUsername = prettyName.toLocaleLowerCase();

	const unixTimezone = await input({
		message: "unix-style timezone",
		default: "America/Chicago",
		required: true,
	})

	const hostname = await input({
		message: "machine hostname",
		default: "pluto",
		required: true,
	})

	console.log("-------------- RECAP ------------------");
	console.log("");
	console.log(`installing to                : /dev/${driveToPart}`);
	console.log(`primary user pretty name     : ${prettyName}`);
	console.log(`primary user internal name   : ${internalUsername}`);
	console.log(`timezone                     : ${unixTimezone}`);
	console.log(`hostname                     : ${hostname}`);
	console.log(``);
	console.log("");
	console.log("---------------------------------------");

	if (!await confirm({ message: "are you ok with these settings?" })) {
		process.exit(0);
	}

	console.log(chalk.green("✔ installing plutoos!"));

	writeFileSync("parttable", `label: gpt
device: /dev/${driveToPart}
unit: sectors

1: size=512MiB,type=C12A7328-F81F-11D2-BA4B-00A0C93EC93B,name=chainloader
2: size=512MiB,type=C12A7328-F81F-11D2-BA4B-00A0C93EC93B,name=efi-a
3: size=512MiB,type=C12A7328-F81F-11D2-BA4B-00A0C93EC93B,name=efi-b
4: size=15GiB,type=4F68BCE3-E8CD-4DB1-96E7-FBCAF984B709,name=root-a
4: size=15GiB,type=4F68BCE3-E8CD-4DB1-96E7-FBCAF984B709,name=root-b
5: type=933AC7E1-2EB4-4F13-B844-0E14E2AEF915,name=user-home`, { encoding: "utf-8" });

	execCommand(`bash -c "cat parttable | sfdisk /dev/${driveToPart}"`)

}

main().catch(error => {
	console.error(error.message);
})