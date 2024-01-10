import { Sounds } from "./sounds";
import { Vector2D } from "./vector";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
canvas.width = window.innerWidth - 5;
canvas.height = window.innerHeight - 5;
canvas.style.width = `${canvas.width - 5}px`;
canvas.style.height = `${canvas.height - 5}px`

const ballsCounterElement = document.getElementById('balls_counter') as HTMLSpanElement;
const resetButtonElement = document.getElementById('reset_button') as HTMLButtonElement;
const enableSoundsButton = document.getElementById('enable_sounds_button') as HTMLButtonElement;

let ballsCounter = 0;
ballsCounterElement.innerText = '0';

resetButtonElement.addEventListener('click', () => {
  app.removeAllBalls();
  ballsCounter = 0;
  addBallToApp();
})

enableSoundsButton.addEventListener('click', () => {
  if (!app.sound.soundsEnabled) {
    app.sound.enableSounds();
    enableSoundsButton.innerText = 'Mute'
  } else {
    app.sound.disableSounds();
    enableSoundsButton.innerText = 'Enable sounds'
  }
})

const GRAVITY_FORCE = new Vector2D({ x: 0, y: 0 }, { y: 9.8, x: 0 })

class Timer {
  private _deltaTime = 0;
  private lastTimeUpdate = Date.now();
  public get deltaTime(): number {
    return this._deltaTime
  }


  public update() {
    this._deltaTime = (Date.now() - this.lastTimeUpdate) / 1000;
    if (this.deltaTime > 2) this._deltaTime = 0;
    this.lastTimeUpdate = Date.now();
  }
}

abstract class Entity {
  public readonly id: string;
  public abstract render(ctx: CanvasRenderingContext2D): void;
  public abstract update(timer: Timer): void;

  static ENTITIES_COUNT: number = 0;

  constructor() {
    this.id = `entity_${Entity.ENTITIES_COUNT}`;
    Entity.ENTITIES_COUNT += 1;
  }
}

class EntityList {
  private list: Map<Entity['id'], Entity> = new Map();
  public getList(): Entity[] {
    return Array.from(this.list.values());
  }

  constructor(preload?: Entity[]) {
    if (preload) {
      preload.forEach(item => {
        this.list.set(item.id, item);
      })
    }
  }

  public addEntity(...entities: Entity[]): Entity[] {
    for (const entity of entities) {
      if (this.list.has(entity.id)) throw new Error(`Entity with id ${entity.id} is already exist!`);
      this.list.set(entity.id, entity);
    }

    return this.getList();
  }

  public removeEntity(entity: Entity): void {
    if (this.list.has(entity.id) === false) return;
    this.list.delete(entity.id);
  }

  public flushEntities(): void {
    this.getList().forEach(item => {
      this.removeEntity(item);
    })
  }
}

class EntityPosition {
  public x: number = 0;
  public y: number = 0;

  constructor(x?: number, y?: number) {
    if (x) this.x = x;
    if (y) this.y = y;
  }
}

interface BallConstructorProps {
  initialPosition?: { x?: number, y?: number }
  size?: number;
  onBallCollide?: OnBallCollide;
  onArenaCollide?: OnArenaCollide;
}

const ballColors = ['red', 'blue', 'yellow', 'orange', 'green', 'purple', 'cyan']

type OnBallCollide = (thisBall: Ball, collidedBall: Ball) => void
type OnArenaCollide = (thisBall: Ball, arena: Arena) => void

class Ball extends Entity {
  public position: EntityPosition = new EntityPosition();
  public radius: number = arena.radius * 0.04;
  public speed = new Vector2D();
  private energyLossCoefficient = 1;
  private color = ballColors[Math.floor(Math.random() * ballColors.length)];
  public onBallCollideOtherBall: OnBallCollide | null = null;
  public onCollideWithArena: OnArenaCollide | null = null;

  constructor(props?: BallConstructorProps) {
    super();
    if (props) {
      if (props.initialPosition) {
        this.position = new EntityPosition(props.initialPosition.x, props.initialPosition.y);
      }
      if (props.size) {
        this.radius = props.size
      }
      if (props.onArenaCollide) this.onCollideWithArena = props.onArenaCollide
      if (props.onBallCollide) this.onBallCollideOtherBall = props.onBallCollide
    }
  }

  public checkCollisionWithBall(other: Ball): boolean {
    const dist = new Vector2D(this.position, other.position);

    if (dist.length <= (this.radius + other.radius)) return true;
    return false;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.position

    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2)
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  public update(timer: Timer): void {
    this.applyGravity()
    this.position.y += this.speed.b.y * timer.deltaTime;
    this.position.x += this.speed.b.x * timer.deltaTime;
    if (this.checkArenaCollision(arena)) {
      this.teleportInsideArena(arena);
      this.reflectFromArenaWall(arena);
      this.onCollideWithArena?.(this, arena);
    }
  }

  private applyGravity() {
    this.speed.add(GRAVITY_FORCE);
  }

  private checkArenaCollision(arena: Arena): boolean {
    const distance = new Vector2D(arena.position, this.position);
    if (distance.length > arena.radius - this.radius) return true;
    return false;
  }

  private teleportInsideArena(arena: Arena): void {
    const dist = new Vector2D(arena.position, this.position);
    const newPosition: EntityPosition = {
      x: arena.position.x + dist.normalized.x * (arena.radius - this.radius + 5), // + 5 is safe distance from arena
      y: arena.position.y + dist.normalized.y * (arena.radius - this.radius + 5),
    };
    this.position = newPosition;
  }

  private reflectFromArenaWall(arena: Arena): void {
    const dist = new Vector2D(arena.position, this.position);

    if (dist.length >= arena.radius - this.radius) {
      const normal = dist.normalized;
      const penetrationDepth = dist.length - (arena.radius - this.radius);

      this.speed.reflect(normal);
      this.speed.b.multiply(this.energyLossCoefficient);

      this.position.x -= normal.x * penetrationDepth;
      this.position.y -= normal.y * penetrationDepth;
    }
  }


}

class Application {
  public timer = new Timer();
  private ctx: CanvasRenderingContext2D;
  public entities: EntityList;
  public sound = new Sounds();

  constructor(canvas: HTMLCanvasElement, entities?: Entity[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get rendering context');
    this.ctx = ctx;
    this.entities = new EntityList(entities)
  }

  public removeAllBalls() {
    this.entities.getList().forEach(item => {
      if (item instanceof Ball) this.entities.removeEntity(item)
    })
  }

  private applyActionForEveryEntity(action: (entity: Entity) => void) {
    for (const entity of this.entities.getList()) {
      action(entity)
    }
  }

  private update() {
    this.timer.update();
    this.applyActionForEveryEntity(entity => {
      entity.update(this.timer);
    })
  }

  private checkCollisions(): void {
    const balls = this.entities.getList().filter(item => item instanceof Ball) as Ball[];

    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const other = balls[j];
        if (!other) continue;
        const isCollided = ball.checkCollisionWithBall(other);
        if (isCollided) {
          ball.onBallCollideOtherBall?.(ball, other);
          other.onBallCollideOtherBall?.(other, ball);
        }
      }
    }
  }

  private clearBackground(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }

  private render() {
    this.clearBackground(this.ctx);
    this.applyActionForEveryEntity(entity => {
      entity.render(this.ctx);
    })
  }

  public play() {
    this.update();
    this.checkCollisions();
    this.render();

    window.requestAnimationFrame(this.play.bind(this));
  }
}

class Arena extends Entity {
  public readonly radius = (Math.min(canvas.height, canvas.width) / 2) * 0.8;
  public readonly position: EntityPosition = {
    x: canvas.width / 2,
    y: canvas.height / 2
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
  }

  public update(): void {

  }
}

const app = new Application(canvas);

function addBallToApp(): void {
  const radius = 45;
  const angle = Math.random() * 2 * Math.PI;

  const ball = new Ball({
    initialPosition: {
      x: canvas.width / 2 + radius * Math.cos(angle),
      y: canvas.height / 2 + radius * Math.sin(angle),
    },
    onArenaCollide: () => {
      addBallToApp();
      app.sound.beep();
    },
    onBallCollide: (a, b) => {
      app.entities.removeEntity(a);
      app.entities.removeEntity(b);
    }
  });

  const speedX = Math.random() * 900;
  const speedY = Math.random() * 350;
  ball.speed.b.setX(Math.random() >= 0.5 ? speedX : -speedX);
  ball.speed.b.setY(Math.random() >= 0.5 ? speedY : -speedY);

  app.entities.addEntity(ball)

  incrementBallsCounter();
}

function renderCounter() {
  ballsCounterElement.innerText = ballsCounter.toString();
}

function incrementBallsCounter() {
  ballsCounter += 1;
  renderCounter();
}

const arena = new Arena();
app.entities.addEntity(arena)
addBallToApp();

app.play();