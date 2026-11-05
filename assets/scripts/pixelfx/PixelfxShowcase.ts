import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    JsonAsset,
    Label,
    Layers,
    Node,
    ResolutionPolicy,
    Sprite,
    UITransform,
    Vec3,
    director,
    resources,
    view,
} from 'cc';
import { PixelfxSprite } from './PixelfxSprite';

const { ccclass, menu } = _decorator;

type EffectEntry = {
    id: string;
    name: string;
    desc?: string;
    frameSize: [number, number];
};

type EffectIndex = { effects: EffectEntry[] };

/** A small preview scene: every exported effect plays once, then the next one starts. */
@ccclass('PixelfxShowcase')
@menu('pixelfx/Showcase')
export class PixelfxShowcase extends Component {
    private effects: EffectEntry[] = [];
    private cursor = -1;
    private effectNode: Node | null = null;
    private title: Label | null = null;
    private detail: Label | null = null;
    private busy = false;

    onLoad() {
        view.setDesignResolutionSize(960, 640, ResolutionPolicy.SHOW_ALL);
        this.node.layer = Layers.Enum.UI_2D;
        const canvas = this.node.addComponent(Canvas);
        canvas.alignCanvasWithScreen = true;
        const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        const visible = view.getVisibleSize();
        ui.setContentSize(visible.width, visible.height);

        const cameraNode = new Node('Showcase Camera');
        cameraNode.layer = Layers.Enum.UI_2D;
        cameraNode.setPosition(new Vec3(0, 0, 1000));
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 640;
        camera.near = 1;
        camera.far = 2000;
        camera.clearColor = new Color(12, 11, 18, 255);
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        canvas.cameraComponent = camera;
        this.node.addChild(cameraNode);

        this.title = this.makeLabel('pixelfx · loading effects', 24, 0, 270);
        this.detail = this.makeLabel('Cocos Creator 3.8.8', 14, 0, 238);
    }

    start() {
        resources.load('pixelfx/index', JsonAsset, (error, asset) => {
            if (error) {
                this.title!.string = 'pixelfx · resource load failed';
                this.detail!.string = String(error);
                console.error(error);
                return;
            }
            this.effects = ((asset.json as EffectIndex).effects ?? []).slice();
            this.playNext();
        });
    }

    private playNext() {
        if (this.busy || !this.effects.length) return;
        this.busy = true;
        this.cursor = (this.cursor + 1) % this.effects.length;
        const entry = this.effects[this.cursor];
        this.effectNode?.destroy();
        const node = this.effectNode = new Node(`Effect ${entry.id}`);
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(0, -18, 0);
        const sprite = node.addComponent(Sprite);
        const fx = node.addComponent(PixelfxSprite);
        fx.autoplay = false;
        fx.useMetadataLoop = false;
        fx.loop = false;
        fx.pixelScale = Math.min(2, 520 / Math.max(entry.frameSize[0], entry.frameSize[1]));
        fx.effectId = entry.id;
        this.node.addChild(node);
        void fx.play().then(() => {
            this.busy = false;
            node.once('pixelfx-complete', () => this.scheduleOnce(() => this.playNext(), 0.25));
        }).catch((error) => {
            this.busy = false;
            this.detail!.string = `${entry.id} · ${String(error)}`;
            console.error(error);
            this.scheduleOnce(() => this.playNext(), 0.5);
        });
        this.title!.string = `${this.cursor + 1} / ${this.effects.length}  ${entry.name}`;
        this.detail!.string = entry.desc ?? entry.id;
    }

    private makeLabel(text: string, fontSize: number, x: number, y: number) {
        const node = new Node('Label');
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(x, y, 0);
        const ui = node.addComponent(UITransform);
        ui.setContentSize(920, 40);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.color = new Color(235, 232, 240, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        this.node.addChild(node);
        return label;
    }
}
