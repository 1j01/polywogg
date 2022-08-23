import * as w4 from "./wasm4";

import { playerMidSprite } from "../build/png2src-generated/playerMid";
// import { playerHighSprite } from "../build/png2src-generated/playerHigh";
import { playerLowSprite } from "../build/png2src-generated/playerLow";

let started = true; // for development, start game immediately

class Player {
    constructor(
        public gamepadPtr: usize,
        public drawColors: usize,
        public x: i32,
        public y: i32,
        public vx: f32,
        public vy: f32,
        public facing: Facing,
        public stance: Stance,
        public health: i32,
        public lungeTimer: i32,
        public stunTimer: i32,
        public prevGamepadState: u8,
    ) {
    }
}

enum Facing {
    Left = -1,
    Right = 1,
}

enum Stance {
    High = -1,
    Mid = 0,
    Low = 1,
}

let player1 = new Player(w4.GAMEPAD1, 0x42, 90, 80, 0, 0, Facing.Left, Stance.Mid, 100, 0, 0, 0);
let player2 = new Player(w4.GAMEPAD2, 0x24, 60, 80, 0, 0, Facing.Right, Stance.Mid, 100, 0, 0, 0);

let players = [player1, player2];

const groundLevel = 95;

function onGround(player: Player): bool {
    return player.y >= groundLevel;
}

function updatePlayer(player: Player): void {
    const gamepad = load<u8>(player.gamepadPtr);
    const grounded = onGround(player);
    const stunned = player.stunTimer > 0;
    const lunging = player.lungeTimer > 0;
    const justPressedButton1 = gamepad & w4.BUTTON_1 && !(player.prevGamepadState & w4.BUTTON_1);
    const justPressedButton2 = gamepad & w4.BUTTON_2 && !(player.prevGamepadState & w4.BUTTON_2);
    if (!lunging && !stunned) {
        player.vx = 0;
        if (gamepad & w4.BUTTON_LEFT) {
            player.vx -= 1;
            player.facing = Facing.Left;
        }
        if (gamepad & w4.BUTTON_RIGHT) {
            player.vx += 1;
            player.facing = Facing.Right;
        }
    } else {
        player.vx *= 0.9;
    }
    if (grounded) {
        if (justPressedButton1 && !stunned) {
            player.vy = -3;
        }
        if (gamepad & w4.BUTTON_UP) {
            player.stance = Stance.High;
        } else if (gamepad & w4.BUTTON_DOWN) {
            player.stance = Stance.Low;
        } else {
            player.stance = Stance.Mid;
        }
    } else {
        player.vy += 0.2;
    }

    if (justPressedButton2) {
        if (!lunging && !stunned) {
            player.lungeTimer = 15;
            player.vx = player.facing as f32 * 5;
        }
    }

    for (let i = 0; i < players.length; i++) {
        if (players[i] === player) continue;
        const otherPlayer = players[i];
        if (lunging) {
            if (
                Math.abs(otherPlayer.x - player.x + player.facing as i32 * 5) < 9 &&
                otherPlayer.stunTimer <= 0 // TODO: separate invincibility timer
            ) {
                otherPlayer.vx += player.facing as f32 * 3;
                otherPlayer.stunTimer = 10;
                otherPlayer.health -= 10;
            }
        }
    }

    player.x += player.vx as i32;
    player.y += player.vy as i32;
    if (player.y > groundLevel) {
        player.y = groundLevel;
    }
    player.lungeTimer--;
    player.stunTimer--;
    player.prevGamepadState = gamepad;
}

function drawPlayer(player: Player): void {
    store<u16>(w4.DRAW_COLORS, player.drawColors);
    const sprite = player.stance == Stance.Low ? playerLowSprite : playerMidSprite;
    const x = player.x - (sprite.width / 2);
    const y = player.y - sprite.height;
    const flags = sprite.flags | (w4.BLIT_FLIP_X * (player.facing == Facing.Left ? 1 : 0));
    w4.blit(sprite.data, x, y, sprite.width, sprite.height, flags);

    // draw sword
    const swordX = player.x + (player.facing == Facing.Left ? -2 : 1);
    const swordY = player.y - 4 + (player.stance as i32);

    w4.line(swordX, swordY, swordX + (player.facing as i32) * 4, swordY + (player.stance as i32) * 3);

    // debug
    // store<u16>(w4.DRAW_COLORS, 0x2);
    // outlinedText(`lungeTimer: ${player.lungeTimer}`, player.x - 40, player.y + (player.gamepadPtr - w4.GAMEPAD1) * 10);
}

export function start(): void {
    // palette by Polyphrog - appropriate for a game called "Polywogg"
    // https://lospec.com/palette-list/black-tar
    store<u32>(w4.PALETTE, 0x843c35, 0 * sizeof<u32>());
    store<u32>(w4.PALETTE, 0xffeb94, 1 * sizeof<u32>());
    store<u32>(w4.PALETTE, 0x398a75, 2 * sizeof<u32>());
    store<u32>(w4.PALETTE, 0x26153a, 3 * sizeof<u32>());
    // https://lospec.com/palette-list/lava-level
    // store<u32>(w4.PALETTE, 0x726059, 0 * sizeof<u32>());
    // store<u32>(w4.PALETTE, 0x301922, 1 * sizeof<u32>());
    // store<u32>(w4.PALETTE, 0xcf331e, 2 * sizeof<u32>());
    // store<u32>(w4.PALETTE, 0xf29d2c, 3 * sizeof<u32>());
}

function outlinedText(text: string, x: i32, y: i32): void {
    store<u16>(w4.DRAW_COLORS, 0x4);
    w4.text(text, x - 1, y);
    w4.text(text, x + 1, y);
    w4.text(text, x, y - 1);
    w4.text(text, x, y + 1);
    w4.text(text, x + 1, y + 1); // shadow
    store<u16>(w4.DRAW_COLORS, 0x2);
    w4.text(text, x, y);
}

export function update(): void {

    outlinedText("Welcome to\n\n    Polywogg!", 10, 10);

    const gamepad = load<u8>(w4.GAMEPAD1);
    if (gamepad & w4.BUTTON_1) {
        if (!started) {
            started = true;
        }
        store<u16>(w4.DRAW_COLORS, 3);
    }

    if (started) {
        for (let i = 0; i < 100; i++) {
            const x = 64 + i32(Math.sin(f32(i) / 10) * 64);
            const y = 100 + i32(Math.cos(f32(i) / 10) * 6);
            store<u16>(w4.DRAW_COLORS, 0x23);
            w4.blit(playerMidSprite.data, x, y, w4.BLIT_2BPP, x, y);
        }

        for (let i = 0; i < players.length; i++) {
            updatePlayer(players[i]);
            drawPlayer(players[i]);
        }
    } else {
        store<u16>(w4.DRAW_COLORS, 0x23);
        w4.text("Press X to start", 16, 90);
    }
}
