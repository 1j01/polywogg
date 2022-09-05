var assert = require('assert');
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

describe('Polywogg', () => {
	describe('P1 to right, P2 to left, going towards each other', () => {
		beforeEach(() => {
			m.players[0].x = 80 + 10;
			m.players[1].x = 80 - 10;
			for (let i = 0; i < 50; i++) {
				m.update("FOR_TEST");
			}
		});
		it('should have both survive', () => {
			assert(m.players[0].health > 0, "P1 should survive");
			assert(m.players[1].health > 0, "P2 should survive");
		});
	});
});
