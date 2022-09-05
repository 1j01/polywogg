var assert = require('assert');
const w4 = require("../build/tsc/src/wasm4");
const stubs = require("../build/tsc/src/wasm4-stubs");
for (const k in stubs) {
	w4[k] = stubs[k];
}
global.memory = {
	data() { }
}
const memStore = new Map;
global.store = (ptr, value) => {
	memStore.set(ptr, value);
};
global.load = (ptr) => memStore.get(ptr);
global.u8 = (x) => x | 0;
global.changetype = (x) => x;
global.sizeof = (x) => 1;
m = require("../build/tsc/src/main");
// m.start();

function sim(steps = 100) {
	for (let i = 0; i < steps; i++) {
		m.update("FOR_TEST");
	}
}

describe('Polywogg', () => {
	describe('P1 to right, P2 to left, going towards each other', () => {
		beforeEach(() => {
			m.initMatch();
			m.players[0].x = 80 + 10;
			m.players[1].x = 80 - 10;
		});
		it('should have both survive', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT);
			sim();
			assert(m.players[0].health > 0, "P1 should have survived");
			assert(m.players[1].health > 0, "P2 should have survived");
		});
		it('should have both survive if both tilt up', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT | w4.BUTTON_UP);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT | w4.BUTTON_UP);
			sim();
			assert(m.players[0].health > 0, "P1 should have survived");
			assert(m.players[1].health > 0, "P2 should have survived");
		});
		it('should have both survive if both tilt down', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT | w4.BUTTON_DOWN);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT | w4.BUTTON_DOWN);
			sim();
			assert(m.players[0].health > 0, "P1 should have survived");
			assert(m.players[1].health > 0, "P2 should have survived");
		});
		it('should have P2 win if P1 is tilting up', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT | w4.BUTTON_UP);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT);
			sim();
			assert(m.players[0].health <= 0, "P1 should have died");
			assert(m.players[1].health > 0, "P2 should have survived");
		});
		it('should have P1 win if P2 is tilting up', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT | w4.BUTTON_UP);
			sim();
			assert(m.players[0].health > 0, "P1 should have survived");
			assert(m.players[1].health <= 0, "P2 should have died");
		});
		it('should have P2 win if P1 is tilting down', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT | w4.BUTTON_DOWN);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT);
			sim();
			assert(m.players[0].health <= 0, "P1 should have died");
			assert(m.players[1].health > 0, "P2 should have survived");
		});
		it('should have P1 win if P2 is tilting down', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT | w4.BUTTON_DOWN);
			sim();
			assert(m.players[0].health > 0, "P1 should have survived");
			assert(m.players[1].health <= 0, "P2 should have died");
		});
		it('should have both die if P1 is tilting up and P2 is tilting down', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT | w4.BUTTON_UP);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT | w4.BUTTON_DOWN);
			sim();
			assert(m.players[0].health <= 0, "P1 should have died");
			assert(m.players[1].health <= 0, "P2 should have died");
		});
		it('should have both die if P1 is tilting down and P2 is tilting up', () => {
			store(w4.GAMEPAD1, w4.BUTTON_LEFT | w4.BUTTON_DOWN);
			store(w4.GAMEPAD2, w4.BUTTON_RIGHT | w4.BUTTON_UP);
			sim();
			assert(m.players[0].health <= 0, "P1 should have died");
			assert(m.players[1].health <= 0, "P2 should have died");
		});
	});
});
