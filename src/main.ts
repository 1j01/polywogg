import * as w4 from "./wasm4";

import { playerMidSprite } from "../build/png2src-generated/playerMid";
// import { playerHighSprite } from "../build/png2src-generated/playerHigh";
import { playerLowSprite } from "../build/png2src-generated/playerLow";

const skipReadyWaiting = true; // for development, start game immediately

const groundLevel = 154;

class Player {
    public stance: Stance = Stance.Mid;
    public health: i32 = 100;
    public dead: bool = false; // separate from health so both players can die in one frame (avoiding asymmetry for fairness (seeking symmetry))
    public jumpTimer: i32 = 0;
    public lungeTimer: i32 = 0;
    public stunTimer: i32 = 0;
    public prevGamepadState: u8 = 0xff; // bits set to prevent jumping when starting game
    public vx: f64 = 0;
    public vy: f64 = 0;
    public ready: bool = skipReadyWaiting;
    constructor(
        public gamepadPtr: usize,
        public drawColors: usize,
        public x: i32,
        public y: i32,
        public facing: Facing,
    ) {
    }
    static clone(p: Player, _i: i32 = 0, _a: Player[] = []): Player {
        const pCopy = new Player(p.gamepadPtr, p.drawColors, p.x, p.y, p.facing);
        pCopy.stance = p.stance;
        pCopy.health = p.health;
        pCopy.dead = p.dead;
        pCopy.jumpTimer = p.jumpTimer;
        pCopy.lungeTimer = p.lungeTimer;
        pCopy.stunTimer = p.stunTimer;
        pCopy.prevGamepadState = p.prevGamepadState;
        pCopy.vx = p.vx;
        pCopy.vy = p.vy;
        pCopy.ready = p.ready;
        return pCopy;
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

class Particle {
    public vx: f64;
    public vy: f64;
    constructor(
        public x: f64,
        public y: f64,
        public r: i32,
        public drawColors: usize,
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

export let players: Player[];
let arches: Arch[];
let particles: Particle[];

let timeSinceMatchStart = 0;
let timeSinceMatchEnd = 0;

// outside of start() function because it doesn't seem to work with netplay otherwise
initMatch();

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
    particles = [];
}

function checkCollision(x: i32, y: i32, w: i32): i32 {
    if (y >= groundLevel) {
        return groundLevel;
    }
    for (let i = 0; i < arches.length; i++) {
        const arch = arches[i];
        if (x + w / 2 > arch.x && x - w / 2 < arch.x + arch.w) {
            if (y >= arch.y - 2 && y < arch.y + 2) {
                return arch.y;
            }
        }
    }
    return 0;
}

function updatePlayer(player: Player): void {
    const gamepad = load<u8>(player.gamepadPtr);
    const collisionY = checkCollision(player.x, player.y, 6);
    const grounded = collisionY != 0;

    const stunned = player.stunTimer > 0;
    const lunging = player.lungeTimer > 0;
    const justPressedButton1 = gamepad & w4.BUTTON_1 && !(player.prevGamepadState & w4.BUTTON_1);
    const justPressedButton2 = gamepad & w4.BUTTON_2 && !(player.prevGamepadState & w4.BUTTON_2);

    if (!player.dead) {
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
                player.vy = Math.min(player.vy, 2);
            }
        }

        // Starting attacking
        if (justPressedButton2) {
            if (!lunging && !stunned) {
                player.lungeTimer = 15;
                player.vx = player.facing as f64 * 5;
            }
        }

        // Attack/kill the other player
        for (let i = 0; i < players.length; i++) {
            if (players[i] === player) continue;
            const otherPlayer = players[i];
            const blocked =
                otherPlayer.stance == player.stance &&
                otherPlayer.facing !== player.facing;
            const swordReach = player.stance == Stance.Mid ? 6 : 4;
            const swordX = player.x + (player.facing as i32 * swordReach);
            const swordY = player.y - 4 + (player.stance as i32 * 5);
            if (
                Math.abs(otherPlayer.x - swordX) < 2 &&
                Math.abs(otherPlayer.y - 4 - swordY) < 7 &&
                otherPlayer.stunTimer <= 0 && // TODO: separate invincibility timer, or prevent double hits by tracking whether the lunge has hit a player
                !otherPlayer.dead
            ) {
                otherPlayer.vx += player.facing as f64 * 3;
                otherPlayer.stunTimer = 10;
                if (blocked) {
                    player.vx *= 0.3;
                } else {
                    // Don't set otherPlayer.dead = true;
                    // That will happen at the end of the frame,
                    // so it's symmetrical: both players can kill each other in the same frame.
                    otherPlayer.health = 0;
                    // Blood effect
                    for (let i = 0; i < 20; i++) {
                        const particle = new Particle(otherPlayer.x, otherPlayer.y, 2, otherPlayer.drawColors >> 4);
                        particle.vx = Math.random() * 5 - 3;
                        particle.vy = Math.random() * 5 - 3;
                        particles.push(particle);
                        if (particles.length > 50) {
                            particles.shift();
                        }
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

    // Debug
    // store<u16>(w4.DRAW_COLORS, player.drawColors);
    // outlinedText(`vy: ${player.vy}`, player.x - 40, player.y + (player.gamepadPtr - w4.GAMEPAD1) * 10);
    // outlinedText(`grounded: ${grounded}`, player.x - 40, player.y + (player.gamepadPtr - w4.GAMEPAD1) * 10);
}

function updateParticle(particle: Particle): void {
    const collisionY = checkCollision(particle.x as i32, particle.y as i32, particle.r * 2 as i32);
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.2;
    if (collisionY != 0 && particle.y > collisionY) {
        particle.y = collisionY;
        particle.vx = 0; // perfect friction for blood
    }
}

function drawPlayer(player: Player): void {
    store<u16>(w4.DRAW_COLORS, player.drawColors);
    const sprite = player.stance == Stance.Low ? playerLowSprite : playerMidSprite;
    const x = player.x - (sprite.width / 2);
    let y = player.y - sprite.height;
    let flags = sprite.flags;
    if (player.dead) {
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

function drawParticle(particle: Particle): void {
    store<u16>(w4.DRAW_COLORS, particle.drawColors);
    w4.line(particle.x as i32, particle.y as i32, particle.x as i32, particle.y as i32);
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

    // Game logic initialized at top level because doing it in here doesn't seem to work with netplay.
    // https://github.com/aduros/wasm4/issues/542
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
    // w += Math.sin(timeSinceMatchStart as f64 / 100) * 150 as i32; w = Math.max(w, 1) as i32;
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
    const nRadialBricks = Math.round((archW - 20) / 6) * 2 + 7; // odd number for a centered keystone
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
    for (let i = 0; i < w; i++) {
        const lineX = x + i;
        // w4.line(x, y, x, y + (1 + Math.tan(i * 2)) * 2 as i32);
        w4.line(lineX, y, lineX, y + (1 + Math.sin(i * 200)) * 2 as i32);
    }
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
            if (newY < y || newX > x + w || newX < x) {
                break;
            }
            store<u16>(w4.DRAW_COLORS, 0x2);
            w4.line(vineX + 1, vineY - 1, newX + 1, newY - 1);
            store<u16>(w4.DRAW_COLORS, 0x1);
            w4.line(vineX, vineY, newX, newY);
            vineX = newX;
            vineY = newY;
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
        const oldPlayers: Player[] = players.map<Player>(Player.clone);
        const newPlayers: Player[] = players.map<Player>(Player.clone);
        const newOtherPlayers: Player[] = players.map<Player>(Player.clone);
        for (let i = 0; i < players.length; i++) {
            if (timeSinceMatchStart >= countdownTime) {
                // Reset so updatePlayer sees old view of the world,
                // cloning so that oldPlayers isn't affected.
                for (let j = 0; j < players.length; j++) {
                    players[j] = Player.clone(oldPlayers[j]);
                }
                // Run game logic
                updatePlayer(players[i]);

                // Track changes to players
                if (players[i].gamepadPtr !== oldPlayers[i].gamepadPtr) newPlayers[i].gamepadPtr = players[i].gamepadPtr;
                if (players[i].drawColors !== oldPlayers[i].drawColors) newPlayers[i].drawColors = players[i].drawColors;
                if (players[i].x !== oldPlayers[i].x) newPlayers[i].x = players[i].x;
                if (players[i].y !== oldPlayers[i].y) newPlayers[i].y = players[i].y;
                if (players[i].facing !== oldPlayers[i].facing) newPlayers[i].facing = players[i].facing;
                if (players[i].stance !== oldPlayers[i].stance) newPlayers[i].stance = players[i].stance;
                if (players[i].health !== oldPlayers[i].health) newPlayers[i].health = players[i].health;
                if (players[i].dead !== oldPlayers[i].dead) newPlayers[i].dead = players[i].dead;
                if (players[i].jumpTimer !== oldPlayers[i].jumpTimer) newPlayers[i].jumpTimer = players[i].jumpTimer;
                if (players[i].lungeTimer !== oldPlayers[i].lungeTimer) newPlayers[i].lungeTimer = players[i].lungeTimer;
                if (players[i].stunTimer !== oldPlayers[i].stunTimer) newPlayers[i].stunTimer = players[i].stunTimer;
                if (players[i].prevGamepadState !== oldPlayers[i].prevGamepadState) newPlayers[i].prevGamepadState = players[i].prevGamepadState;
                if (players[i].vx !== oldPlayers[i].vx) newPlayers[i].vx = players[i].vx;
                if (players[i].vy !== oldPlayers[i].vy) newPlayers[i].vy = players[i].vy;
                if (players[i].ready !== oldPlayers[i].ready) newPlayers[i].ready = players[i].ready;

                // Track changes to OTHER players during updatePlayer
                for (let j = 0; j < players.length; j++) {
                    if (i === j) continue;
                    if (players[j].gamepadPtr !== oldPlayers[j].gamepadPtr) newOtherPlayers[j].gamepadPtr = players[j].gamepadPtr;
                    if (players[j].drawColors !== oldPlayers[j].drawColors) newOtherPlayers[j].drawColors = players[j].drawColors;
                    if (players[j].x !== oldPlayers[j].x) newOtherPlayers[j].x = players[j].x;
                    if (players[j].y !== oldPlayers[j].y) newOtherPlayers[j].y = players[j].y;
                    if (players[j].facing !== oldPlayers[j].facing) newOtherPlayers[j].facing = players[j].facing;
                    if (players[j].stance !== oldPlayers[j].stance) newOtherPlayers[j].stance = players[j].stance;
                    if (players[j].health !== oldPlayers[j].health) newOtherPlayers[j].health = players[j].health;
                    if (players[j].dead !== oldPlayers[j].dead) newOtherPlayers[j].dead = players[j].dead;
                    if (players[j].jumpTimer !== oldPlayers[j].jumpTimer) newOtherPlayers[j].jumpTimer = players[j].jumpTimer;
                    if (players[j].lungeTimer !== oldPlayers[j].lungeTimer) newOtherPlayers[j].lungeTimer = players[j].lungeTimer;
                    if (players[j].stunTimer !== oldPlayers[j].stunTimer) newOtherPlayers[j].stunTimer = players[j].stunTimer;
                    if (players[j].prevGamepadState !== oldPlayers[j].prevGamepadState) newOtherPlayers[j].prevGamepadState = players[j].prevGamepadState;
                    if (players[j].vx !== oldPlayers[j].vx) newOtherPlayers[j].vx = players[j].vx;
                    if (players[j].vy !== oldPlayers[j].vy) newOtherPlayers[j].vy = players[j].vy;
                    if (players[j].ready !== oldPlayers[j].ready) newOtherPlayers[j].ready = players[j].ready;
                }
            }
        }
        // Update game state to version containing all changes
        // No copying needed because newPlayers will never be used again.
        players = newPlayers;
        // Merge in changes to OTHER players that happened during updatePlayer.
        // I'm giving priority to changes to OTHER players
        // because knocking the other player back is
        // more important and exceptional than walking.
        // There will likely be a scenario where the opposite is desired,
        // in which case this system will fall apart.
        // It will also break down if updatePlayer modifies anything other than players (and particles).
        for (let i = 0; i < players.length; i++) {
            if (newOtherPlayers[i].gamepadPtr !== oldPlayers[i].gamepadPtr) players[i].gamepadPtr = newOtherPlayers[i].gamepadPtr;
            if (newOtherPlayers[i].drawColors !== oldPlayers[i].drawColors) players[i].drawColors = newOtherPlayers[i].drawColors;
            if (newOtherPlayers[i].x !== oldPlayers[i].x) players[i].x = newOtherPlayers[i].x;
            if (newOtherPlayers[i].y !== oldPlayers[i].y) players[i].y = newOtherPlayers[i].y;
            if (newOtherPlayers[i].facing !== oldPlayers[i].facing) players[i].facing = newOtherPlayers[i].facing;
            if (newOtherPlayers[i].stance !== oldPlayers[i].stance) players[i].stance = newOtherPlayers[i].stance;
            if (newOtherPlayers[i].health !== oldPlayers[i].health) players[i].health = newOtherPlayers[i].health;
            if (newOtherPlayers[i].dead !== oldPlayers[i].dead) players[i].dead = newOtherPlayers[i].dead;
            if (newOtherPlayers[i].jumpTimer !== oldPlayers[i].jumpTimer) players[i].jumpTimer = newOtherPlayers[i].jumpTimer;
            if (newOtherPlayers[i].lungeTimer !== oldPlayers[i].lungeTimer) players[i].lungeTimer = newOtherPlayers[i].lungeTimer;
            if (newOtherPlayers[i].stunTimer !== oldPlayers[i].stunTimer) players[i].stunTimer = newOtherPlayers[i].stunTimer;
            if (newOtherPlayers[i].prevGamepadState !== oldPlayers[i].prevGamepadState) players[i].prevGamepadState = newOtherPlayers[i].prevGamepadState;
            if (newOtherPlayers[i].vx !== oldPlayers[i].vx) players[i].vx = newOtherPlayers[i].vx;
            if (newOtherPlayers[i].vy !== oldPlayers[i].vy) players[i].vy = newOtherPlayers[i].vy;
            if (newOtherPlayers[i].ready !== oldPlayers[i].ready) players[i].ready = newOtherPlayers[i].ready;
        }


        for (let i = 0; i < players.length; i++) {
            // could remove dead in favor of health
            // now that I'm making ALL properties update only after all players have updated, effectively
            // right?
            players[i].dead = players[i].health <= 0;
        }

        for (let i = 0; i < players.length; i++) {
            drawPlayer(players[i]);
        }
        for (let i = 0; i < particles.length; i++) {
            updateParticle(particles[i]);
            drawParticle(particles[i]);
        }

        if (timeSinceMatchStart < countdownTime) {
            store<u8>(w4.DRAW_COLORS, 0x43);
            outlinedText(Math.ceil((countdownTime - timeSinceMatchStart) as f64 / 60).toString().at(0), 75, 10);
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
