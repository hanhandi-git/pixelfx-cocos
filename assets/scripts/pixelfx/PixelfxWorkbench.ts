import {
    _decorator,
    Button,
    Camera,
    Canvas,
    Color,
    Component,
    Graphics,
    JsonAsset,
    Label,
    Layers,
    Layout,
    Mask,
    Node,
    Rect,
    ScrollView,
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
    tags?: string[];
    loop?: boolean;
    fps?: number;
    frames?: number;
    frameSize?: [number, number];
    pivot?: [number, number];
};

type EffectIndex = { effects: EffectEntry[] };

const COLORS = {
    bg: new Color(10, 12, 20, 255),
    panel: new Color(20, 24, 38, 245),
    panel2: new Color(26, 32, 51, 255),
    line: new Color(53, 64, 92, 255),
    text: new Color(235, 238, 248, 255),
    muted: new Color(157, 169, 196, 255),
    accent: new Color(103, 210, 255, 255),
    accent2: new Color(183, 132, 255, 255),
    selected: new Color(38, 84, 116, 255),
};

/** Cocos Creator workbench for browsing and previewing every exported effect. */
@ccclass('PixelfxWorkbench')
@menu('pixelfx/Workbench')
export class PixelfxWorkbench extends Component {
    private canvas!: Canvas;
    private preview!: PixelfxSprite;
    private previewNode!: Node;
    private listContent!: Node;
    private categoryContent!: Node;
    private selectedButton: Node | null = null;
    private title!: Label;
    private subtitle!: Label;
    private info!: Label;
    private playButton!: { node: Node; label: Label };
    private effects: EffectEntry[] = [];
    private filtered: EffectEntry[] = [];
    private selectedIndex = 0;
    private selectedCategory = 'all';

    onLoad() {
        view.setDesignResolutionSize(1440, 900, view.getDesignResolutionSize().height >= view.getDesignResolutionSize().width ? 1 : 3);
        this.buildCameraAndCanvas();
        this.buildWorkbench();
    }

    start() {
        resources.load('pixelfx/index', JsonAsset, (error, asset) => {
            if (error) {
                this.title.string = 'PIXELFX WORKBENCH · RESOURCE ERROR';
                this.subtitle.string = String(error);
                return;
            }
            this.effects = ((asset.json as EffectIndex).effects ?? []).slice();
            this.filtered = this.effects;
            this.subtitle.string = `${this.effects.length} exported effects · choose one to preview`;
            this.buildCategories();
            this.renderList();
            if (this.filtered.length) this.selectEffect(0);
        });
    }

    private buildCameraAndCanvas() {
        const scene = director.getScene()!;
        const canvasNode = new Node('Pixelfx Workbench Canvas');
        canvasNode.layer = Layers.Enum.UI_2D;
        this.canvas = canvasNode.addComponent(Canvas);
        const canvasTransform = canvasNode.addComponent(UITransform);
        canvasTransform.setContentSize(1440, 900);
        const cameraNode = new Node('Pixelfx Workbench Camera');
        cameraNode.layer = Layers.Enum.UI_2D;
        cameraNode.setPosition(new Vec3(0, 0, 1000));
        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 900;
        camera.near = 1;
        camera.far = 2000;
        camera.visibility = Layers.Enum.UI_2D;
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        camera.clearColor = COLORS.bg;
        this.canvas.cameraComponent = camera;
        canvasNode.addChild(cameraNode);
        scene.addChild(canvasNode);
    }

    private buildWorkbench() {
        const root = this.canvas.node;
        this.addPanel(root, 0, 0, 1440, 900, COLORS.bg, COLORS.bg);
        this.title = this.addLabel(root, 'PIXELFX WORKBENCH', 30, COLORS.text, 0, 405, 1440, 48, true);
        this.subtitle = this.addLabel(root, 'Loading exported Cocos Creator resources…', 15, COLORS.muted, 0, 366, 1440, 30);

        this.addPanel(root, -520, -10, 350, 730, COLORS.panel, COLORS.line);
        this.addLabel(root, 'EFFECT LIBRARY', 15, COLORS.accent, -520, 320, 300, 28, true);
        this.categoryContent = this.createScroll(root, -520, 262, 310, 55, true);
        this.listContent = this.createScroll(root, -520, -55, 310, 560, false);

        this.addPanel(root, 235, -10, 1080, 730, COLORS.panel, COLORS.line);
        this.addLabel(root, 'PREVIEW', 15, COLORS.accent, -260, 320, 300, 28, true);
        this.previewNode = new Node('Selected Effect Preview');
        this.previewNode.layer = Layers.Enum.UI_2D;
        this.previewNode.active = false;
        this.previewNode.setPosition(new Vec3(235, 45, 0));
        const sprite = this.previewNode.addComponent(Sprite);
        this.preview = this.previewNode.addComponent(PixelfxSprite);
        this.preview.autoplay = false;
        this.preview.playAll = false;
        this.preview.pixelPerfect = true;
        this.canvas.node.addChild(this.previewNode);
        void sprite;

        this.addPanel(root, 235, -300, 980, 120, COLORS.panel2, COLORS.line);
        this.info = this.addLabel(root, 'No effect selected', 15, COLORS.text, 235, -282, 900, 70, false);
        this.playButton = this.addActionButton(root, 'PLAY', 55, -345, () => this.togglePlay());
        this.addActionButton(root, 'REPLAY', 175, -345, () => this.replay());
        this.addActionButton(root, 'PREVIOUS', 305, -345, () => this.selectRelative(-1));
        this.addActionButton(root, 'NEXT', 455, -345, () => this.selectRelative(1));
        this.addLabel(root, 'PNG/JSON assets · nearest filtering · exported pivot', 13, COLORS.muted, 820, -345, 340, 30);
    }

    private buildCategories() {
        this.categoryContent.removeAllChildren();
        const categories = ['all', ...Array.from(new Set(this.effects.map((effect) => effect.id.split('/')[0])))];
        categories.forEach((category) => {
            const count = category === 'all' ? this.effects.length : this.effects.filter((effect) => effect.id.startsWith(`${category}/`)).length;
            const button = this.addListButton(this.categoryContent, `${category.toUpperCase()}  ${count}`, () => {
                this.selectedCategory = category;
                this.filtered = category === 'all' ? this.effects : this.effects.filter((effect) => effect.id.startsWith(`${category}/`));
                this.renderList();
                if (this.filtered.length) this.selectEffect(0);
            }, 120, true);
            button.name = `Category ${category}`;
        });
        const categoryTransform = this.categoryContent.getComponent(UITransform)!;
        categoryTransform.setContentSize(Math.max(310, categories.length * 122 + 4), 55);
        this.categoryContent.getComponent(Layout)?.updateLayout();
    }

    private renderList() {
        this.listContent.removeAllChildren();
        this.filtered.forEach((effect, index) => {
            const button = this.addListButton(this.listContent, `${String(index + 1).padStart(3, '0')}  ${effect.name}`, () => this.selectEffect(index), 300, false);
            button.name = `Effect ${effect.id.replaceAll('/', '／')}`;
            if (index === this.selectedIndex) this.paintButton(button, true);
        });
        const listTransform = this.listContent.getComponent(UITransform)!;
        listTransform.setContentSize(300, Math.max(560, this.filtered.length * 39 + 8));
        this.listContent.getComponent(Layout)?.updateLayout();
    }

    private selectEffect(index: number) {
        if (!this.filtered.length) return;
        this.selectedIndex = Math.max(0, Math.min(index, this.filtered.length - 1));
        const effect = this.filtered[this.selectedIndex];
        if (this.selectedButton) this.paintButton(this.selectedButton, false);
        const buttons = this.listContent.children;
        this.selectedButton = buttons[this.selectedIndex] ?? null;
        if (this.selectedButton) this.paintButton(this.selectedButton, true);
        this.previewNode.active = true;
        this.preview.effectId = effect.id;
        this.preview.destroyOnComplete = false;
        this.preview.useMetadataLoop = true;
        this.preview.speed = 1;
        void this.preview.play(effect.id);
        this.playButton.label.string = 'PAUSE';
        const size = effect.frameSize?.join(' × ') ?? '—';
        const tags = effect.tags?.slice(0, 6).join(' · ') ?? effect.id.split('/')[0];
        this.info.string = `${effect.name}\n${effect.id}   ·   ${size}px   ·   ${effect.frames ?? '—'} frames @ ${effect.fps ?? '—'} fps   ·   ${effect.loop ? 'LOOP' : 'ONE-SHOT'}\n${tags}`;
    }

    private selectRelative(offset: number) {
        if (!this.filtered.length) return;
        this.selectEffect((this.selectedIndex + offset + this.filtered.length) % this.filtered.length);
    }

    private togglePlay() {
        if (!this.preview) return;
        if (this.preview.isPlaying) {
            this.preview.pause();
            this.playButton.label.string = 'PLAY';
        } else {
            this.preview.resume();
            this.playButton.label.string = 'PAUSE';
        }
    }

    private replay() {
        if (!this.filtered.length) return;
        void this.preview.play(this.filtered[this.selectedIndex].id);
        this.playButton.label.string = 'PAUSE';
    }

    private createScroll(parent: Node, x: number, y: number, width: number, height: number, horizontal: boolean) {
        const node = new Node(horizontal ? 'Category Scroll' : 'Effect Scroll');
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        node.addComponent(Mask);
        const scroll = node.addComponent(ScrollView);
        scroll.horizontal = horizontal;
        scroll.vertical = !horizontal;
        const content = new Node('Content');
        content.layer = Layers.Enum.UI_2D;
        const contentTransform = content.addComponent(UITransform);
        contentTransform.setAnchorPoint(0, 1);
        const layout = content.addComponent(Layout);
        layout.type = horizontal ? Layout.Type.HORIZONTAL : Layout.Type.VERTICAL;
        layout.spacingX = horizontal ? 6 : 0;
        layout.spacingY = horizontal ? 0 : 5;
        layout.paddingLeft = 2;
        layout.paddingTop = 2;
        node.addChild(content);
        scroll.content = content;
        parent.addChild(node);
        return content;
    }

    private addListButton(parent: Node, text: string, onClick: () => void, width: number, compact: boolean) {
        const node = new Node(text.replaceAll('/', '／'));
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(compact ? 116 : width, compact ? 38 : 34);
        node.addComponent(Button);
        node.on(Node.EventType.TOUCH_END, onClick);
        node.on(Node.EventType.MOUSE_UP, onClick);
        const label = this.addLabel(node, text, compact ? 11 : 12, COLORS.muted, 0, 0, compact ? 116 : width, compact ? 38 : 34);
        label.overflow = Label.Overflow.SHRINK;
        parent.addChild(node);
        this.paintButton(node, false);
        return node;
    }

    private paintButton(node: Node, selected: boolean) {
        let graphics = node.getComponent(Graphics);
        if (!graphics) graphics = node.addComponent(Graphics);
        const transform = node.getComponent(UITransform)!;
        graphics.clear();
        graphics.fillColor = selected ? COLORS.selected : COLORS.panel2;
        graphics.roundRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height, 6);
        graphics.fill();
        graphics.strokeColor = selected ? COLORS.accent : COLORS.line;
        graphics.lineWidth = 1;
        graphics.roundRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height, 6);
        graphics.stroke();
    }

    private addActionButton(parent: Node, text: string, x: number, y: number, onClick: () => void) {
        const node = new Node(text);
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(112, 34);
        node.addComponent(Button);
        node.on(Node.EventType.TOUCH_END, onClick);
        const label = this.addLabel(node, text, 12, COLORS.text, 0, 0, 112, 34, true);
        this.paintButton(node, false);
        parent.addChild(node);
        return { node, label };
    }

    private addPanel(parent: Node, x: number, y: number, width: number, height: number, fill: Color, stroke: Color) {
        const node = new Node('Panel');
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = fill;
        graphics.roundRect(-width / 2, -height / 2, width, height, 12);
        graphics.fill();
        graphics.strokeColor = stroke;
        graphics.lineWidth = 1;
        graphics.roundRect(-width / 2, -height / 2, width, height, 12);
        graphics.stroke();
        parent.addChild(node);
        return node;
    }

    private addLabel(parent: Node, text: string, fontSize: number, color: Color, x: number, y: number, width: number, height: number, bold = false) {
        const node = new Node('Label');
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.isBold = bold;
        parent.addChild(node);
        return label;
    }
}
