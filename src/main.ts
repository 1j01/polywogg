import * as w4 from "./wasm4";

import { playerMidSprite } from "../build/png2src-generated/playerMid";
// import { playerHighSprite } from "../build/png2src-generated/playerHigh";
import { playerLowSprite } from "../build/png2src-generated/playerLow";

const groundLevel = 95;

class Player {
    public stance: Stance;
    public health: i32 = 100;
    public lungeTimer: i32;
    public stunTimer: i32;
    public prevGamepadState: u8 = 0xff; // bits set to prevent jumping when starting game
    public vx: f32;
    public vy: f32;
    // public ready: bool = true; // for development, start game immediately
    public ready: bool = false;
    constructor(
        public gamepadPtr: usize,
        public drawColors: usize,
        public x: i32,
        public y: i32,
        public facing: Facing,
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


let player1 = new Player(w4.GAMEPAD1, 0x42, 90, groundLevel, Facing.Left);
let player2 = new Player(w4.GAMEPAD2, 0x24, 60, groundLevel, Facing.Right);

let players = [player1, player2];

let t = 0;

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

function drawGround(): void {
    store<u16>(w4.DRAW_COLORS, 0x3);
    w4.rect(0, groundLevel, 160, 160 - groundLevel)
    store<u16>(w4.DRAW_COLORS, 0x4);
    for (let i = 0; i < 100; i++) {
        const centerX = 80;
        const centerY = groundLevel + (160 - groundLevel) / 2;
        const x = centerX + (Math.sin(i * i * 500) * 80) as i32;
        const y = centerY + (Math.cos(i * i * 5230) * (160 - groundLevel) / 2) as i32;
        w4.line(x, y, x + (Math.sin(i * i * 420) + 0.1) as i32, y + 5 + Math.sin(i * i * 459) * 2 as i32);
        w4.line(x + (Math.sin(i * i * 420) + 0.1) * 5 as i32, y, x + (Math.sin(i * i * 420) + 0.1) * 5 as i32, y + 5 + Math.sin(i * i * 459) * 2 as i32);
    }
}

export function update(): void {

    const ready = players.every((player) => player.ready);

    if (ready) {
        t++;
        const countdownTime = 60 * 5;
        const fightFlashTime = 50;
        if (t < countdownTime) {
            outlinedText(Math.ceil((countdownTime - t) as f32 / 60).toString().at(0), 75, 10);
        } else if (t < countdownTime + fightFlashTime && (t % 10) < 5) {
            outlinedText("Fight!", 60, 10);
        }

        drawGround();
        for (let i = 0; i < players.length; i++) {
            if (t >= countdownTime) {
                updatePlayer(players[i]);
            }
            drawPlayer(players[i]);
        }
    } else {
        t = 0;
        outlinedText("Welcome to\n\n    Polywogg!", 10, 10);

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            store<u16>(w4.DRAW_COLORS, 0x23);
            const gamepad = load<u8>(player.gamepadPtr);
            const button1 = gamepad & w4.BUTTON_1;
            if (button1) {
                player.ready = true;
            }
            const message = player.ready ? "Ready!" : "Waiting...";
            w4.text(`P${i + 1}: ${message}`, 20, 90 + i * 20);
        }
    }
}
