const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const walk = require("walk");
const argv = require("./argv.js");

// Read and format JSON flag documentation
if (argv.help || process.argv.length === 2) {
	const columnify = require("columnify");
	console.log(`box-js is a utility to analyze malicious JavaScript files.

Usage:
    box-js <files|directories> [args]

Arguments:
	`);
	console.log(columnify(
		argv.flags.map((flag) => ({
			name: (flag.alias ? `-${flag.alias}, ` : "") + `--${flag.name}`,
			description: flag.description,
		})),
		{
			config: {
				description: {
					maxWidth: 80,
				},
			},
		}
	));
	process.exit(0);
}

if (argv.version) {
	console.log(require("./package.json").version);
	process.exit(0);
}

if (argv.license) {
	console.log(fs.readFileSync(__dirname + "/LICENSE", "utf8"));
	process.exit(0);
}

const timeout = Number(argv.timeout) || 10;
if (!argv.timeout)
	console.log("Using a 10 seconds timeout, pass --timeout to specify another timeout in seconds");

const outputDir = argv["output-dir"] || "./";

const isFile = (filepath) => {
	try {
		fs.statSync(filepath);
		return true;
	} catch (e) {
		return false;
	}
};

const options = process.argv
	.slice(2)
	.filter((filepath) => !isFile(filepath));

options.push(`--timeout=${timeout}`);

const tasks = process.argv
	.slice(2)
	.filter(isFile)
	.map((filepath) => fs.statSync(filepath).isDirectory() ?
		(cb) => {
			const files = [];
			walk.walkSync(filepath, {
				listeners: {
					file: (root, stat, next) => {
						files.push({root, name: stat.name});
						next();
					},
				},
			});
			return files.map(
				({root, name}) => analyze(path.join(root, name), name, outputDir)
			);
		} :
		() => analyze(filepath, path.basename(filepath), outputDir)
	);

if (tasks.length === 0) {
	console.log("Please pass one or more filenames or directories as an argument.");
	process.exit(-1);
}

// Prevent "possible memory leak" warning
process.setMaxListeners(Infinity);

tasks.forEach((task) => task());

function isDir(filepath) {
	try {
		return fs.statSync(filepath).isDirectory();
	} catch (e) {
		return false;
	}
}

function analyze(filepath, filename, outputDir) {
	let directory = path.join(outputDir, filename + ".results");
	let i = 1;
	while (isDir(directory)) {
		i++;
		directory = path.join(outputDir, filename + "." + i + ".results");
	}
	fs.mkdirSync(directory);
	directory += "/"; // For ease of use
	const worker = cp.fork(path.join(__dirname, "analyze"), [filepath, directory, ...options]);

	const killTimeout = setTimeout(function killOnTimeOut() {
		console.log(`Analysis for ${filename} timed out.`);
		if (!argv.preprocess) {
			console.log("Hint: if the script is heavily obfuscated, --preprocess --unsafe-preprocess can speed up the emulation.");
		}
		worker.kill();
	}, timeout * 1000);

	worker.on("message", function(data) {
		clearTimeout(killTimeout);
		worker.kill();
	});

	worker.on("exit", function(code, signal) {
		if (code === 1) {
			console.log(`
 * If you see garbled text, try emulating Windows XP with --windows-xp.
 * If the error is about a weird \"Unknown ActiveXObject\", try --no-kill.
 * If the error is about a legitimate \"Unknown ActiveXObject\", report a bug at https://github.com/CapacitorSet/box-js/issues/ .`);
		}
		clearTimeout(killTimeout);
		worker.kill();
		if (argv.debug) process.exit(-1);
	});

	worker.on("error", function(err) {
		console.log(err);
		clearTimeout(killTimeout);
		worker.kill();
	});

	process.on("exit", () => worker.kill());
	process.on("SIGINT", () => worker.kill());
	// process.on('uncaughtException', () => worker.kill());
}