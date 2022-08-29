const w4 = require("../build/tsc/src/wasm4");
const stubs = require("../build/tsc/src/wasm4-stubs");
for (const k in stubs) {
	w4[k] = stubs[k];
}
global.memory = {
	data() { }
}
global.store = () => { };
global.load = (ptr) => {
	switch (ptr) {
		case w4.GAMEPAD1:
			return w4.BUTTON_LEFT;
		case w4.GAMEPAD2:
			return w4.BUTTON_RIGHT;
	}
}
global.u8 = (x) => x | 0;
global.changetype = (x) => x;
global.sizeof = (x) => 1;
m = require("../build/tsc/src/main");
// m.start();
m.players[0].x = 80;
m.players[1].x = 80;
console.log(m.players);
m.update();
console.log(m.players);
require("assert")(m.players[0].stunTimer > 0, "player 1 should be stunned");
require("assert")(m.players[1].stunTimer > 0, "player 2 should be stunned");
