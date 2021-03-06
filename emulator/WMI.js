const lib = require("../lib");

function VirtualWMIObject(object) {
	return new Proxy(object, {
		get: function(target, name) {
			name = name.toLowerCase();
			switch (name) {
				case "instancesof":
					return function(table) {
						table = table.toLowerCase();
						if (table in target) return target[table];
						lib.kill(`WMIObject(${JSON.stringify(target)}).InstancesOf(${table}) not implemented!`);
					};
				default:
					if (name in target) return target[name];
					lib.kill(`WMIObject(${JSON.stringify(target)}).${name} not implemented!`);
			}
		},
	});
}

module.exports.GetObject = function(name) {
	name = name.toLowerCase();
	name = name.replace(/{impersonationlevel=impersonate}/g, "");
	switch (name) {
		case "winmgmts:":
			return new VirtualWMIObject({
				"win32_computersystemproduct": [new VirtualWMIObject({
					name: "Foobar",
				})],
				"win32_operatingsystem": [new VirtualWMIObject({
					caption: "Microsoft Windows 10 Pro",
				})],
				"win32_logicaldisk": [new VirtualWMIObject({ // dirty patch by @ALange
					deviceid: "C:",
					volumeserialnumber: "B55B4A40",
				})],
			});
		case "winmgmts:\\\\localhost\\root\\securitycenter":
			return new VirtualWMIObject({
				"antivirusproduct": [],
			});
		case "winmgmts:\\\\localhost\\root\\securitycenter2":
			return new VirtualWMIObject({
				"antivirusproduct": [],
			});
		default:
			lib.kill(`GetObject(${name}) not implemented!`);
	}
};