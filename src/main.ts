import * as w4 from "./wasm4";

const smiley = memory.data<u8>([
    0b11000011,
    0b10000001,
    0b00100100,
    0b00100100,
    0b00000000,
    0b00100100,
    0b10011001,
    0b11000011,
]);
// sprite
const spriteWidth = 8;
const spriteHeight = 8;
const spriteFlags = 1; // BLIT_2BPP
const sprite = memory.data<u8>([ 0xa5,0x6a,0xa4,0x2a,0xa5,0x68,0x55,0xa2,0xa5,0x4a,0xa5,0xaa,0x9a,0x6a,0x6a,0x6a ]);

let t = 0;
export function update (): void {
    store<u16>(w4.DRAW_COLORS, 2);
    w4.text("Hello from\nAssemblyScript!", 10, 10);

    const gamepad = load<u8>(w4.GAMEPAD1);
    if (gamepad & w4.BUTTON_1) {
        store<u16>(w4.DRAW_COLORS, 3);
        w4.blit(smiley, 76, 76, 8, 8, w4.BLIT_2BPP);
    }

    w4.blit(smiley, 76, 76, 8, 8, w4.BLIT_1BPP);
    w4.text("Press X to blink", 16, 90);

    t++;
    const c = ~~(t / 100);
    store<u16>(w4.DRAW_COLORS, c);
    w4.blit(sprite, 36, 76, spriteWidth, spriteHeight, spriteFlags);
    w4.text("c=" + c.toString(), 16, 110);
    store<u16>(w4.DRAW_COLORS, 3);
    w4.text("c=" + c.toString(), 16, 120);
}
