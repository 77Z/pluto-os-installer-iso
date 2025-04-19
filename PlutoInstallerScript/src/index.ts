import { input, select, confirm } from '@inquirer/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import cliSpinners from "cli-spinners";
import ora from "ora";

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
	
	const prettyName = await input({ message: 'pretty name of primary user', required: true });
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

	const partitioningSpinner = ora({
		spinner: cliSpinners.bouncingBar,
		text: "partitioning drive..."
	});

	// This is so dumb
	writeFileSync("formatscript", `#!/usr/bin/env bash
(
echo g;
echo n;
echo ;
echo ;
echo +512M;
echo t;
echo 1;
echo n;
echo ;
echo ;
echo +512M;
echo t;
echo ;
echo 1;
echo n;
echo ;
echo ;
echo +512M;
echo t;
echo ;
echo 1;
echo n;
echo ;
echo ;
echo +12G;
echo t;
echo ;
echo 23;
echo n;
echo ;
echo ;
echo +12G;
echo t;
echo ;
echo 23;
echo n;
echo ;
echo ;
echo ;
echo t;
echo ;
echo 42;
echo w;
) | fdisk /dev/${driveToPart}

`, { encoding: "utf-8" });

	await execCommand(`bash -c "chmod +x formatscript && ./formatscript"`)

	partitioningSpinner.stopAndPersist({ text: "partitioned drive" });

	console.log(await execCommand(`bash -c "lsblk --raw | grep '${driveToPart}*'"`));

	const partitions: string[] = (await execCommand(`bash -c "lsblk --raw | grep '${driveToPart}*'"`)).stdout.split("\n");

	partitions.shift();

	for (let i = 0; i < partitions.length; i++) {
		partitions[i] = partitions[i].substring(0, partitions[i].indexOf(" "));
	}

	// format first 3 partitions
	const chainloaderPartPath = "/dev/" + partitions[0];
	const efiAPartPath        = "/dev/" + partitions[1];
	const efiBPartPath        = "/dev/" + partitions[2];
	const rootAPartPath       = "/dev/" + partitions[3];
	const rootBPartPath       = "/dev/" + partitions[4];
	const homePartPath        = "/dev/" + partitions[5];


	console.log("-------- partitions to format ---------");

	console.log(`chainloader : ${chainloaderPartPath}   --->  ExFAT`);
	console.log(`efi A       : ${efiAPartPath}   --->  ExFAT`);
	console.log(`efi B       : ${efiBPartPath}   --->  ExFAT`);
	console.log(`root A      : ${rootAPartPath}   --->  EXT4`);
	console.log(`root B      : ${rootBPartPath}   --->  EXT4`);
	console.log(`user home   : ${homePartPath}   --->  EXT4`);

	console.log("---------------------------------------");

	const formattingSpinner = ora({
		spinner: cliSpinners.bouncingBar,
		text: "formatting partitions..."
	});

	await execCommand(`mkfs.fat -F32 ${chainloaderPartPath}`);
	await execCommand(`mkfs.fat -F32 ${efiAPartPath}`);
	await execCommand(`mkfs.fat -F32 ${efiBPartPath}`);
	await execCommand(`mkfs.ext4 ${rootAPartPath}`);
	await execCommand(`mkfs.ext4 ${rootBPartPath}`);
	await execCommand(`mkfs.ext4 ${homePartPath}`);

	formattingSpinner.stopAndPersist({ text: "formatted partitions" });

	const chainloaderInstallSpinner = ora({
		spinner: cliSpinners.bouncingBar,
		text: "installing chainloader..."
	});

	await new Promise((resolve) => setTimeout(resolve, 5000));

	chainloaderInstallSpinner.stopAndPersist({ text: "installed chainloader" });

}

main().catch(error => {
	console.error(error.message);
})