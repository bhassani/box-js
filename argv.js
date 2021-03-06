const fs = require("fs");
const path = require("path");
const commandLineArgs = require("command-line-args");

const flags = JSON.parse(fs.readFileSync(path.join(__dirname, "flags.json"), "utf8"))
	.map((flag) => {
		if (flag.type === "String") flag.type = String;
		if (flag.type === "Number") flag.type = Number;
		if (flag.type === "Boolean") flag.type = Boolean;
		return flag;
	}
	);

module.exports = commandLineArgs(flags);
module.exports.flags = flags;