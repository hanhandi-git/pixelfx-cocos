import {
    _decorator,
    Component,
    Camera,
    Canvas,
    Color,
    gfx,
    JsonAsset,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
    Layers,
    Node,
    ResolutionPolicy,
    view,
    director,
    resources,
} from 'cc';

const { ccclass, menu, property, requireComponent } = _decorator;

type AtlasFrame = {
    frame: { x: number; y: number; w: number; h: number };
    page?: number;
    duration?: number;
};

type PixelfxMeta = {
    fps?: number;
    loop?: boolean;
    frameSize?: [number, number];
    pivot?: [number, number];
    cocos?: { coordinateSystem?: string };
};

type AtlasJson = {
    frames: AtlasFrame[];
    pages?: { image: string; asset?: string }[];
    meta?: { pixelfx?: PixelfxMeta };
};

/**
 * Plays a pixelfx PNG/JSON export on a Cocos Creator 3.x Sprite.
 *
 * Run `node tools/cocos.mjs --out <project>/assets/resources/pixelfx` first,
 * then attach this component to a node with a Sprite. `effectId` uses the
 * source id, for example `fire/campfire` or `moves/sword-combo`.
 */
@ccclass('PixelfxSprite')
@menu('pixelfx/Pixelfx Sprite')
@requireComponent(Sprite)
export class PixelfxSprite extends Component {
    @property({ tooltip: 'Generated resource folder under assets/resources.' })
    assetRoot = 'pixelfx';

    @property({ tooltip: 'Effect id, for example fire/campfire.' })
    effectId = 'fire/campfire';

    @property({ tooltip: 'Start loading and playing in start().' })
    autoplay = true;

    @property({ tooltip: 'Playback multiplier. 0 pauses; negative values are not supported.' })
    speed = 1;

    @property({ tooltip: 'Use the loop flag exported by pixelfx metadata.' })
    useMetadataLoop = true;

    @property({ tooltip: 'Override metadata loop when useMetadataLoop is false.' })
    loop = false;

    @property({ tooltip: 'Destroy the node after a non-looping animation finishes.' })
    destroyOnComplete = false;

    @property({ tooltip: 'Scale the pixel art after the SpriteFrame is applied.' })
    pixelScale = 1;

    @property({ tooltip: 'Point filtering keeps pixel edges crisp.' })
    pixelPerfect = true;

    @property({ tooltip: 'Preview every effect in resources/pixelfx/index.json in order.' })
    playAll = false;

    private sprite!: Sprite;
    private uiTransform!: UITransform;
    private frames: SpriteFrame[] = [];
    private durations: number[] = [];
    private metadata: PixelfxMeta = {};
    private frameIndex = 0;
    private frameTime = 0;
    private playing = false;
    private loadToken = 0;
    private sequence: { id: string }[] = [];
    private sequenceIndex = -1;

    onLoad() {
        this.sprite = this.getComponent(Sprite)!;
        this.uiTransform = this.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        this.node.layer = Layers.Enum.UI_2D;
        this.node.setScale(this.pixelScale, this.pixelScale, 1);
        this.ensurePreviewCamera();
    }

    start() {
        console.log(`[pixelfx] start ${this.effectId} playAll=${this.playAll}`);
        if (!this.autoplay) return;
        if (this.playAll) {
            resources.load('pixelfx/index', JsonAsset, (error, asset) => {
                if (error) return console.error(error);
                this.sequence = ((asset.json?.effects ?? []) as { id: string }[]);
                console.log(`[pixelfx] loaded index: ${this.sequence.length} effects`);
                this.sequenceIndex = -1;
                this.playNextInSequence();
            });
        } else void this.play().catch((error) => console.error(error));
    }

    update(dt: number) {
        if (!this.playing || this.frames.length === 0 || this.speed <= 0) return;
        this.frameTime += dt * this.speed;
        while (this.frameTime >= this.durations[this.frameIndex]) {
            this.frameTime -= this.durations[this.frameIndex];
            if (this.frameIndex + 1 < this.frames.length) {
                this.frameIndex += 1;
                this.sprite.spriteFrame = this.frames[this.frameIndex];
                continue;
            }
            if (this.isLooping) {
                this.frameIndex = 0;
                this.sprite.spriteFrame = this.frames[0];
                continue;
            }
            this.frameTime = 0;
            this.playing = false;
            this.node.emit('pixelfx-complete', this.effectId);
            if (this.playAll) this.scheduleOnce(() => this.playNextInSequence(), 0.25);
            if (this.destroyOnComplete && this.node.isValid) this.node.destroy();
            break;
        }
    }

    /** Load an effect and start it. The returned promise resolves after the first frame is visible. */
    async play(id = this.effectId): Promise<void> {
        this.effectId = id;
        console.log(`[pixelfx] play ${id}`);
        this.node.setScale(this.pixelScale, this.pixelScale, 1);
        const token = ++this.loadToken;
        this.playing = false;
        this.frameIndex = 0;
        this.frameTime = 0;
        const base = `${this.assetRoot}/${id}`;
        const [firstTexture, jsonAsset] = await Promise.all([
            this.loadResource<Texture2D>(`${base}/texture`, Texture2D),
            this.loadResource<JsonAsset>(base, JsonAsset),
        ]);
        if (!this.node.isValid || token !== this.loadToken) return;
        const atlas = jsonAsset.json as AtlasJson;
        const meta = atlas.meta?.pixelfx ?? {};
        const pagePaths = atlas.pages?.length
            ? atlas.pages.map((_page, pageIndex) => `${base}${pageIndex ? `-${pageIndex}` : ''}/texture`)
            : [`${base}/texture`];
        const textures = [firstTexture, ...(await Promise.all(pagePaths.slice(1).map((path) => this.loadResource<Texture2D>(path, Texture2D))))];
        if (!this.node.isValid || token !== this.loadToken) return;
        const size = meta.frameSize ?? [firstTexture.width, firstTexture.height] as [number, number];
        const pivot = meta.pivot ?? [size[0] / 2, size[1] / 2] as [number, number];
        const topLeft = meta.cocos?.coordinateSystem !== 'bottom-left';

        this.releaseFrames();
        this.metadata = meta;
        if (this.pixelPerfect) textures.forEach((texture) => {
            texture.setFilters(gfx.Filter.POINT, gfx.Filter.POINT);
            texture.setWrapMode(gfx.Address.CLAMP, gfx.Address.CLAMP, gfx.Address.CLAMP);
        });
        this.frames = (atlas.frames ?? []).map((entry) => {
            const r = entry.frame;
            const texture = textures[entry.page ?? 0] ?? firstTexture;
            // Cocos SpriteFrame.rect uses top-left texture coordinates, matching
            // the exporter. Convert only metadata from a bottom-left producer.
            const y = topLeft ? r.y : texture.height - r.y - r.h;
            const frame = new SpriteFrame();
            frame.reset({
                texture,
                rect: new Rect(r.x, y, r.w, r.h),
                originalSize: new Size(size[0], size[1]),
                offset: new Vec2(0, 0),
            });
            frame.packable = false;
            return frame;
        });
        this.durations = (atlas.frames ?? []).map((entry) => Math.max(0.001, (entry.duration ?? 1000 / (meta.fps || 30)) / 1000));
        if (this.frames.length === 0) throw new Error(`[pixelfx] ${id} has no frames`);

        // Cocos nodes use a bottom-left normalized anchor. Pixelfx's pivot is
        // measured from the top-left, hence the inverted y component here.
        this.uiTransform.setAnchorPoint(pivot[0] / size[0], 1 - pivot[1] / size[1]);
        this.uiTransform.setContentSize(size[0], size[1]);
        this.sprite.spriteFrame = this.frames[0];
        this.playing = true;
    }

    pause() { this.playing = false; }
    resume() { if (this.frames.length) this.playing = true; }
    stop() { this.playing = false; this.frameIndex = 0; this.frameTime = 0; if (this.frames[0]) this.sprite.spriteFrame = this.frames[0]; }

    get isPlaying() { return this.playing; }
    get isLooping() { return this.useMetadataLoop ? !!this.metadata.loop : this.loop; }
    get currentFrame() { return this.frameIndex; }

    onDestroy() {
        this.loadToken += 1;
        this.releaseFrames();
    }

    private releaseFrames() {
        if (this.sprite) this.sprite.spriteFrame = null;
        for (const frame of this.frames) frame.destroy();
        this.frames = [];
        this.durations = [];
    }

    private loadResource<T>(path: string, type: any): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, type, (error: Error | null, asset: T) => {
                if (error) reject(error);
                else resolve(asset);
            });
        });
    }

    private playNextInSequence() {
        if (!this.sequence.length) return;
        this.sequenceIndex = (this.sequenceIndex + 1) % this.sequence.length;
        void this.play(this.sequence[this.sequenceIndex].id).catch((error) => {
            console.error(error);
            this.scheduleOnce(() => this.playNextInSequence(), 0.5);
        });
    }

    private ensurePreviewCamera() {
        const scene = director.getScene();
        if (!scene || scene.getComponentInChildren(Camera)) return;
        view.setDesignResolutionSize(960, 640, ResolutionPolicy.SHOW_ALL);
        const canvasNode = new Node('Pixelfx Canvas');
        canvasNode.layer = Layers.Enum.UI_2D;
        const canvas = canvasNode.addComponent(Canvas);
        const ui = canvasNode.addComponent(UITransform);
        const visible = view.getVisibleSize();
        ui.setContentSize(visible.width, visible.height);
        const cameraNode = new Node('Pixelfx Camera');
        cameraNode.layer = Layers.Enum.UI_2D;
        cameraNode.setPosition(0, 0, 1000);
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 640;
        camera.near = 1;
        camera.far = 2000;
        camera.clearColor = new Color(12, 11, 18, 255);
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        canvas.cameraComponent = camera;
        canvasNode.addChild(cameraNode);
        scene.addChild(canvasNode);
        canvasNode.addChild(this.node);
    }
}
