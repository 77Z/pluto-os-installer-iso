// BE AWARE!! This is some messy code...

import { input, select, confirm } from '@inquirer/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { readFileSync, statSync, writeFileSync } from 'fs';
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

function getUUIDfromBlkidOutput(blkidData: string[], devPath: string): string | null {

	// Example data
	// /dev/nvme0n1p3: UUID="f89d4c25-1963-40a1-a92f-6091362ca396" BLOCK_SIZE="4096" TYPE="ext4" PARTUUID="6e2edffe-1884-47da-9a17-20ba18ae17f9"

	for (let i = 0; i < blkidData.length; i++) {
		if (blkidData[i].startsWith(devPath)) {
			const stringToParse = blkidData[i]; // see example data above
			const uuidExtractPart1 =  stringToParse.substring(stringToParse.indexOf(`UUID="`) + 6);
			return uuidExtractPart1.substring(0, uuidExtractPart1.indexOf(`"`));
		}
	}

	return null;
}

async function main() {

	// verify we are running on the live ISO to not mess up anyone's real
	// systems by accident :/
	try { statSync("/version"); }
	catch (error) {
		console.error("Not running on PlutoOS Installer ISO!");
		process.exit(1);
	}

	console.log(chalk.green("PlutoOS Installer v0.1.3"));

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

	await executeCommand(`bash -c "chmod +x formatscript && ./formatscript"`)

	partitioningSpinner.stopAndPersist({ text: "partitioned drive" });

	console.log(await executeCommand(`bash -c "lsblk --raw | grep '${driveToPart}*'"`));

	const partitions: string[] = (await executeCommand(`bash -c "lsblk --raw | grep '${driveToPart}*'"`)).split("\n");

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

	await executeCommand(`mkfs.fat -F32 ${chainloaderPartPath}`);
	await executeCommand(`mkfs.fat -F32 ${efiAPartPath}`);
	await executeCommand(`mkfs.fat -F32 ${efiBPartPath}`);
	await executeCommand(`mkfs.ext4 ${rootAPartPath}`);
	await executeCommand(`mkfs.ext4 ${rootBPartPath}`);
	await executeCommand(`mkfs.ext4 ${homePartPath}`);

	formattingSpinner.stopAndPersist({ text: "formatted partitions" });


	// Label partitions with a file in their root directories

	await executeCommand(`mount --mkdir ${chainloaderPartPath} /mnt/chainloader`);
	await executeCommand(`mount --mkdir ${efiAPartPath} /mnt/efiA`);
	await executeCommand(`mount --mkdir ${efiBPartPath} /mnt/efiB`);
	await executeCommand(`mount --mkdir ${rootAPartPath} /mnt/rootA`);
	await executeCommand(`mount --mkdir ${rootBPartPath} /mnt/rootB`);
	await executeCommand(`mount --mkdir ${homePartPath} /mnt/home`);

	writeFileSync(`/mnt/rootA/label`, "rootA", "utf-8");
	writeFileSync(`/mnt/rootB/label`, "rootB", "utf-8");

	await executeCommand(`dosfslabel ${chainloaderPartPath} CHAINLOADER`);

	const blkidOutput: string[] = (await executeCommand("blkid")).split("\n");

	const efiAUUID = getUUIDfromBlkidOutput(blkidOutput, efiAPartPath);
	const efiBUUID = getUUIDfromBlkidOutput(blkidOutput, efiBPartPath);
	const rootAUUID = getUUIDfromBlkidOutput(blkidOutput, rootAPartPath);
	const rootBUUID = getUUIDfromBlkidOutput(blkidOutput, rootBPartPath);
	const homeUUID = getUUIDfromBlkidOutput(blkidOutput, homePartPath);

	// ASSERT
	if (!efiAUUID || !efiBUUID || !rootAUUID || !rootBUUID || !homeUUID) {
		console.error(chalk.red("failed to get uuids!"));
		process.exit(1);
	}

	console.log("--------- persistant uuids ------------");
	console.log(`efi A       : ${efiAUUID}`);
	console.log(`efi B       : ${efiBUUID}`);
	console.log(`root A      : ${rootAUUID}`);
	console.log(`root B      : ${rootBUUID}`);
	console.log(`user home   : ${homeUUID}`);
	console.log("---------------------------------------");

	console.log(chalk.green("Writing partition uuid table to chainloader!"));

	writeFileSync("/mnt/chainloader/uuidtable", JSON.stringify({
		efiA: efiAUUID,
		efiB: efiBUUID,
		rootA: rootAUUID,
		rootB: rootBUUID,
		home: homeUUID,
	}), 'utf-8');

	console.log("Unmounting everything");
	await executeCommand(`umount /mnt/chainloader`);
	await executeCommand(`umount /mnt/efiA`);
	await executeCommand(`umount /mnt/efiB`);
	await executeCommand(`umount /mnt/rootA`);
	await executeCommand(`umount /mnt/rootB`);
	await executeCommand(`umount /mnt/home`);


	// const chainloaderInstallSpinner = ora({
	// 	spinner: cliSpinners.bouncingBar,
	// 	text: "installing chainloader..."
	// });

	// await new Promise((resolve) => setTimeout(resolve, 5000));

	// chainloaderInstallSpinner.stopAndPersist({ text: "installed chainloader" });

}

main().catch(error => {
	console.error(error.message);
})