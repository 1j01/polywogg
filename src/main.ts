import * as w4 from "./wasm4";

import { playerMidSprite } from "../build/png2src-generated/playerMid";
// import { playerHighSprite } from "../build/png2src-generated/playerHigh";
import { playerLowSprite } from "../build/png2src-generated/playerLow";

const skipReadyWaiting = true; // for development, start game immediately

const groundLevel = 121;

class Player {
    public stance: Stance;
    public health: i32 = 100;
    public jumpTimer: i32;
    public lungeTimer: i32;
    public stunTimer: i32;
    public prevGamepadState: u8 = 0xff; // bits set to prevent jumping when starting game
    public vx: f32;
    public vy: f32;
    public ready: bool = skipReadyWaiting;
    constructor(
        public gamepadPtr: usize,
        public drawColors: usize,
        public x: i32,
        public y: i32,
        public facing: Facing,
    ) {
    }
}

class Arch {
    constructor(
        public x: i32,
        public y: i32,
        public w: i32,
        public h: i32,
    ) { }
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

let players: Player[];
let arches: Arch[];

let timeSinceMatchStart = 0;
let timeSinceMatchEnd = 0;

function initMatch(): void {
    timeSinceMatchStart = 0;
    timeSinceMatchEnd = 0;
    const centerX = 80;
    players = [
        new Player(w4.GAMEPAD1, 0x34, centerX + 30, groundLevel, Facing.Left),
        new Player(w4.GAMEPAD2, 0x43, centerX - 30, groundLevel, Facing.Right),
    ];
    const w = 161;
    const h = 161;
    arches = [
        new Arch(centerX - w / 2, groundLevel - h, w, h)
    ];
    let xOff = 0;
    for (let i = 0; i < 2; i++) {
        const w = (1 - i) * 20 + 21;
        const h = (1 - i) * 20 + 20;
        if (i != 0) {
            xOff += w / 2;
        }
        arches.push(new Arch(centerX + xOff - w / 2, groundLevel - h, w, h));
        if (i != 0) {
            arches.push(new Arch(centerX - xOff - w / 2, groundLevel - h, w, h));
        }
        xOff += w / 2;
    }
}

function checkCollision(player: Player): i32 {
    if (player.y >= groundLevel) {
        return groundLevel;
    }
    for (let i = 0; i < arches.length; i++) {
        const arch = arches[i];
        if (player.x + 3 > arch.x && player.x - 3 < arch.x + arch.w) {
            if (player.y >= arch.y - 2 && player.y < arch.y + 2) {
                return arch.y;
            }
        }
    }
    return 0;
}

function updatePlayer(player: Player): void {
    const gamepad = load<u8>(player.gamepadPtr);
    const collisionY = checkCollision(player);
    const grounded = collisionY != 0;
    // player.y++;
    // const grounded = checkCollision(player) != 0;
    // player.y--;

    const dead = player.health <= 0;
    const stunned = player.stunTimer > 0;
    const lunging = player.lungeTimer > 0;
    const justPressedButton1 = gamepad & w4.BUTTON_1 && !(player.prevGamepadState & w4.BUTTON_1);
    const justPressedButton2 = gamepad & w4.BUTTON_2 && !(player.prevGamepadState & w4.BUTTON_2);

    if (!dead) {
        // Movement
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

        // Tilting
        if (gamepad & w4.BUTTON_UP) {
            player.stance = Stance.High;
        } else if (gamepad & w4.BUTTON_DOWN) {
            player.stance = Stance.Low;
        } else {
            player.stance = Stance.Mid;
        }

        // Jumping
        if (grounded) {
            if (justPressedButton1 && !stunned) {
                player.vy = -2;
                player.jumpTimer = 10;
            }
        } else {
            if (player.jumpTimer > 0 && gamepad & w4.BUTTON_1) {
                // player.vy -= 0.2;
            } else {
                // Gravity
                player.vy += 0.2;
                // Limit fall speed
                player.vy = Math.min(player.vy, 2) as f32;
            }
        }

        // Starting attacking
        if (justPressedButton2) {
            if (!lunging && !stunned) {
                player.lungeTimer = 15;
                player.vx = player.facing as f32 * 5;
            }
        }

        // Handle attacking other players
        for (let i = 0; i < players.length; i++) {
            if (players[i] === player) continue;
            const otherPlayer = players[i];
            const blocked =
                otherPlayer.stance == player.stance &&
                otherPlayer.facing !== player.facing;
            if (lunging) {
                if (
                    Math.abs(otherPlayer.x - player.x + player.facing as i32 * 5) < 9 &&
                    Math.abs(otherPlayer.y - player.y) < 9 &&
                    otherPlayer.stunTimer <= 0 && // TODO: separate invincibility timer, or prevent double hits by tracking whether the lunge has hit a player
                    otherPlayer.health > 0
                ) {
                    otherPlayer.vx += player.facing as f32 * 3;
                    otherPlayer.stunTimer = 10;
                    if (blocked) {
                        player.vx *= 0.3;
                    } else {
                        otherPlayer.health = 0;
                    }
                }
            }
        }
    } else {
        player.vx *= 0.9;
    }

    // Ballistic motion
    player.x += player.vx as i32;
    player.y += player.vy as i32;
    if (grounded && player.y > collisionY) {
        player.y = collisionY;
    }

    // Time
    player.jumpTimer--;
    player.lungeTimer--;
    player.stunTimer--;
    player.prevGamepadState = gamepad;
    // outlinedText(`vy: ${player.vy}`, player.x - 40, player.y + (player.gamepadPtr - w4.GAMEPAD1) * 10);
    // outlinedText(`grounded: ${grounded}`, player.x - 40, player.y + (player.gamepadPtr - w4.GAMEPAD1) * 10);
}

function drawPlayer(player: Player): void {
    store<u16>(w4.DRAW_COLORS, player.drawColors);
    const dead = player.health <= 0;
    const sprite = player.stance == Stance.Low ? playerLowSprite : playerMidSprite;
    const x = player.x - (sprite.width / 2);
    let y = player.y - sprite.height;
    let flags = sprite.flags;
    if (dead) {
        flags |= w4.BLIT_ROTATE;
        if (player.facing == Facing.Left) {
            flags |= w4.BLIT_FLIP_Y;
        }
        y += 2;
    } else {
        if (player.facing == Facing.Left) {
            flags |= w4.BLIT_FLIP_X;
        }
    }
    w4.blit(sprite.data, x, y, sprite.width, sprite.height, flags);

    // draw sword
    const swordX = player.x + (player.facing == Facing.Left ? -2 : 1);
    const swordY = player.y - 4 + (player.stance as i32);

    w4.line(swordX, swordY, swordX + (player.facing as i32) * 4, swordY + (player.stance as i32) * 3);

    // debug
    // outlinedText(`lungeTimer: ${player.lungeTimer}`, player.x - 40, player.y + (player.gamepadPtr - w4.GAMEPAD1) * 10);
}

export function start(): void {
    // palette by Polyphrog - appropriate for a game called "Polywogg"
    // https://lospec.com/palette-list/black-tar
    // store<u32>(w4.PALETTE, 0x843c35, 0 * sizeof<u32>());
    // store<u32>(w4.PALETTE, 0xffeb94, 1 * sizeof<u32>());
    // store<u32>(w4.PALETTE, 0x398a75, 2 * sizeof<u32>());
    // store<u32>(w4.PALETTE, 0x26153a, 3 * sizeof<u32>());
    // https://lospec.com/palette-list/lava-level
    // rearranged so black is 0 (affects the clear color)
    store<u32>(w4.PALETTE, 0x301922, 0 * sizeof<u32>());
    store<u32>(w4.PALETTE, 0x726059, 1 * sizeof<u32>());
    store<u32>(w4.PALETTE, 0xcf331e, 2 * sizeof<u32>());
    store<u32>(w4.PALETTE, 0xf29d2c, 3 * sizeof<u32>());

    initMatch();
}

function outlinedText(text: string, x: i32, y: i32): void {
    const paletteColorA = u8(load<u16>(w4.DRAW_COLORS) & 0b1111);
    const paletteColorB = u8((load<u16>(w4.DRAW_COLORS) & 0b11110000) >> 4);
    store<u16>(w4.DRAW_COLORS, paletteColorB);
    w4.text(text, x - 1, y);
    w4.text(text, x + 1, y);
    w4.text(text, x, y - 1);
    w4.text(text, x, y + 1);
    w4.text(text, x + 1, y + 1); // shadow
    store<u16>(w4.DRAW_COLORS, paletteColorA);
    w4.text(text, x, y);
}

function drawGround(): void {
    store<u16>(w4.DRAW_COLORS, 0x1);
    w4.rect(0, groundLevel, 160, 160 - groundLevel)
    store<u16>(w4.DRAW_COLORS, 0x2);
    for (let i = 0; i < 160; i++) {
        const x = i;
        const y = groundLevel;
        // w4.line(x, y, x, y + (1 + Math.tan(i * 2)) * 2 as i32);
        w4.line(x, y, x, y + (1 + Math.sin(i * 200)) * 2 as i32);
    }

    // grassy style
    // store<u16>(w4.DRAW_COLORS, 0x3);
    // w4.rect(0, groundLevel, 160, 160 - groundLevel)
    // store<u16>(w4.DRAW_COLORS, 0x4);
    // for (let i = 0; i < 100; i++) {
    //     const centerX = 80;
    //     const centerY = groundLevel + (160 - groundLevel) / 2;
    //     const x = centerX + (Math.sin(i * i * 500) * 80) as i32;
    //     const y = centerY + (Math.cos(i * i * 5230) * (160 - groundLevel) / 2) as i32;
    //     w4.line(x, y, x + (Math.sin(i * i * 420) + 0.1) as i32, y + 5 + Math.sin(i * i * 459) * 2 as i32);
    //     w4.line(x + (Math.sin(i * i * 420) + 0.1) * 5 as i32, y, x + (Math.sin(i * i * 420) + 0.1) * 5 as i32, y + 5 + Math.sin(i * i * 459) * 2 as i32);
    // }
}

function drawArch(x: i32, y: i32, w: i32, h: i32): void {
    // w += Math.sin(timeSinceMatchStart as f64 / 100) * 15 as i32;
    const archW = w / 2 as i32;
    const archH = h - archW; // not including curved part
    const archX = x + (w - archW) / 2;
    const archY = y + h - archH;
    const wallW = (w - archW) / 2 + 1; // width of either wall (left or right)

    store<u16>(w4.DRAW_COLORS, 0x21);
    drawBricks(x, y, w, h - archH);
    store<u16>(w4.DRAW_COLORS, 0x21);
    const centerX = archX + archW / 2;
    const centerY = archY;
    const brickR: i32 = archW * 0.7 as i32;
    w4.oval(centerX - brickR, centerY - brickR, brickR * 2, brickR * 2);
    store<u16>(w4.DRAW_COLORS, 0x2);
    const nRadialBricks = 7;
    for (let i = 0; i < nRadialBricks; i++) {
        const angle: f64 = (i as f64) / nRadialBricks * -Math.PI;
        const x2: i32 = centerX + Math.cos(angle) * (brickR - 0.5) as i32;
        const y2: i32 = centerY + Math.sin(angle) * (brickR - 0.5) as i32;
        w4.line(centerX, centerY, x2, y2);
    }
    store<u16>(w4.DRAW_COLORS, 0x21);
    drawBricks(x, archY, wallW, archH);
    drawBricks(x + w - wallW, archY, wallW, archH);

    store<u16>(w4.DRAW_COLORS, 0x21);
    w4.oval(archX, archY - archW / 2, archW, archW);
    store<u16>(w4.DRAW_COLORS, 0x11);
    w4.rect(archX + 1, archY, archW - 2, archH);

    // make top clearer as a platform
    store<u16>(w4.DRAW_COLORS, 0x2);
    w4.rect(x + 1, y - 1, w - 2, 1);
}

function drawBricks(x: i32, y: i32, w: i32, h: i32): void {
    const oldColors = load<u16>(w4.DRAW_COLORS);
    // w4.rect(x, y, w, h);
    for (let loopY = y; loopY < y + h; loopY += 4) {
        for (let loopX = x - (loopY % 8) * 3; loopX < x + w; loopX += 9) {
            const x1 = Math.max(loopX, x) as i32;
            const x2 = Math.min(x + w, loopX + 10) as i32;
            const y1 = loopY;
            const y2 = Math.min(y + h, loopY + 5) as i32;
            if (x2 > x1) {
                w4.rect(x1, y1, x2 - x1, y2 - y1);
                store<u16>(w4.DRAW_COLORS, oldColors);
            }
        }
    }
    // vines
    for (let i = 0; i < 9; i++) {
        let vineX = x + (Math.sin(x * y * w + h * i) * w + w / 2) as i32;
        let vineY = y + h;
        for (let j = 0; j < 15; j++) {
            const newX = vineX + Math.round(Math.sin(x * y * w + h * i + j * x * y + j) * 2) as i32;
            const newY = vineY - (4 + Math.sin(x + y + i + j)) as i32;
            store<u16>(w4.DRAW_COLORS, 0x2);
            w4.line(vineX + 1, vineY - 1, newX + 1, newY - 1);
            store<u16>(w4.DRAW_COLORS, 0x1);
            w4.line(vineX, vineY, newX, newY);
            vineX = newX;
            vineY = newY;
            if (vineY < y || vineX > x + w || vineX < x) {
                break;
            }
        }
    }

    store<u16>(w4.DRAW_COLORS, oldColors);
}

// function drawChains(x: i32, y: i32, w: i32, h: i32): void {
//     store<u16>(w4.DRAW_COLORS, 0x12);
//     w4.rect(x, y, w, h);
//     for (let loopY = y; loopY < y + h; loopY += 3) {
//         for (let loopX = x + loopY % 4; loopX < x + w; loopX += 5) {
//             w4.rect(loopX, loopY, 3, 5);
//         }
//     }
// }

export function update(): void {

    const ready = players.every((player) => player.ready);

    if (ready) {
        timeSinceMatchStart++;
        const ended = players.some((player) => player.health <= 0);
        if (ended) {
            timeSinceMatchEnd++;
        }
        const countdownTime = skipReadyWaiting ? 0 : 60 * 5;
        const fightFlashTime = 50;

        const delayBeforeReset = 50;
        if (timeSinceMatchEnd > delayBeforeReset) {
            initMatch();
        }

        drawGround();
        for (let i = 0; i < arches.length; i++) {
            const a = arches[i];
            drawArch(a.x, a.y, a.w, a.h);
        }
        for (let i = 0; i < players.length; i++) {
            if (timeSinceMatchStart >= countdownTime) {
                updatePlayer(players[i]);
            }
            drawPlayer(players[i]);
        }

        if (timeSinceMatchStart < countdownTime) {
            store<u8>(w4.DRAW_COLORS, 0x43);
            outlinedText(Math.ceil((countdownTime - timeSinceMatchStart) as f32 / 60).toString().at(0), 75, 10);
        } else if (timeSinceMatchStart < countdownTime + fightFlashTime) {
            store<u8>(w4.DRAW_COLORS, (timeSinceMatchStart % 10) < 5 ? 0x34 : 0x43);
            outlinedText("Fight!", 60, 10);
        }
    } else {
        timeSinceMatchStart = 0;
        timeSinceMatchEnd = 0;
        store<u8>(w4.DRAW_COLORS, 0x43);
        outlinedText("Welcome to\n\n    Polywogg!", 10, 10);

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const gamepad = load<u8>(player.gamepadPtr);
            const button1 = gamepad & w4.BUTTON_1;
            if (button1) {
                player.ready = true;
            }
            const message = player.ready ? "Ready!" : "Waiting...";
            store<u16>(w4.DRAW_COLORS, player.drawColors);
            w4.text(`P${i + 1}: ${message}`, 20, 90 + i * 20);
        }
    }
}
