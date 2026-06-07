import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as ExtensionModule from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const ADSP_PATH = '/sys/class/remoteproc/remoteproc0';
const CDSP_PATH = '/sys/class/remoteproc/remoteproc1';

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFile(path) {
    try {
        const [ok, raw] = GLib.file_get_contents(path);
        if (ok) return new TextDecoder().decode(raw).trim();
    } catch (_) {}
    return null;
}

function writeFile(path, value) {
    try {
        GLib.file_set_contents(path, value);
        return true;
    } catch (_) {
        return false;
    }
}

// ── A single toggle row (icon  label  subtitle  switch) ──────────────────────
//   Mirrors the "Location / Camera / Microphone" rows in the screenshot.

const RemoteprocRow = GObject.registerClass({
    Signals: {
        'toggled': { param_types: [GObject.TYPE_BOOLEAN] },
    },
},
class RemoteprocRow extends St.BoxLayout {
    _init({ iconName, label, subtitle }) {
        super._init({
            style_class: 'remoteproc-row',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding: 10px 16px; spacing: 12px;',
        });

        this._icon = new St.Icon({
            icon_name: iconName,
            icon_size: 18,
            style: 'color: rgba(255,255,255,0.75);',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const labelBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._label = new St.Label({
            text: label,
            style: 'font-size: 13px; color: rgba(255,255,255,0.90);',
            y_align: Clutter.ActorAlign.CENTER,
        });
        labelBox.add_child(this._label);

        this._subtitle = new St.Label({
            text: subtitle ?? '',
            style: 'font-size: 11px; color: rgba(255,255,255,0.50);',
            y_align: Clutter.ActorAlign.CENTER,
        });
        labelBox.add_child(this._subtitle);

        this._switch = new PopupMenu.Switch(false);
        this._switch.y_align = Clutter.ActorAlign.CENTER;

        this.add_child(this._icon);
        this.add_child(labelBox);
        this.add_child(this._switch);

        this.reactive = true;
        this.can_focus = true;
        this.track_hover = true;

        this.connect('notify::hover', () => {
            this.style = [
                'padding: 10px 16px; spacing: 12px;',
                this.hover
                    ? 'background-color: rgba(255,255,255,0.07); border-radius: 8px;'
                    : '',
            ].join('');
        });

        this.connect('button-press-event', () => {
            this.emit('toggled', !this._switch.state);
        });

        this.connect('key-press-event', (_actor, event) => {
            const sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_space)
                this.emit('toggled', !this._switch.state);
        });
    }

    get active() { return this._switch.state; }

    setActive(value) { this._switch.state = value; }

    setSubtitle(text) { this._subtitle.text = text; }
});

// ← DELETE the GObject.signal_new(...) line that was here

// ── The popup menu content (the card shown in the screenshot) ────────────────

const RemoteprocMenuSection = GObject.registerClass(
class RemoteprocMenuSection extends St.BoxLayout {
    _init(toggle) {
        super._init({
            vertical: true,
            x_expand: true,
            style: 'min-width: 260px;',
        });

        this._toggle = toggle;

        // ── Header (hand icon + "高通遠端處理器") ──────────────────────────
        const header = new St.BoxLayout({
            style_class: 'remoteproc-header',
            style: 'padding: 14px 16px 10px 16px; spacing: 10px;',
        });

        const iconCircle = new St.Widget({
            style: [
                'width: 42px; height: 42px;',
                'border-radius: 21px;',
                'background-color: rgba(255,255,255,0.15);',
            ].join(''),
            y_align: Clutter.ActorAlign.CENTER,
        });
        const headerIcon = new St.Icon({
            icon_name: 'drive-harddisk-solidstate-symbolic',
            icon_size: 20,
            style: 'color: white;',
        });
        headerIcon.set_pivot_point(0.5, 0.5);
        iconCircle.add_child(headerIcon);
        // Centre the icon inside the circle
        headerIcon.set_position(11, 11);

        const headerLabel = new St.Label({
            text: 'Qualcomm Remote Proc. Manager',
            style: 'font-size: 15px; font-weight: bold; color: white;',
            y_align: Clutter.ActorAlign.CENTER,
        });

        header.add_child(iconCircle);
        header.add_child(headerLabel);
        this.add_child(header);

        // ── Toggle rows ───────────────────────────────────────────────────
        this._adspRow = new RemoteprocRow({
            iconName: 'audio-card-symbolic',
            label: 'ADSP',
            subtitle: 'Checking…',
        });
        this._cdspRow = new RemoteprocRow({
            iconName: 'video-display-symbolic',
            label: 'CDSP',
            subtitle: 'Checking…',
        });

        this.add_child(this._adspRow);
        this.add_child(this._cdspRow);

        // Individual row toggles
        this._adspRow.connect('toggled', (_row, state) => this._setProcessor(ADSP_PATH, state));
        this._cdspRow.connect('toggled', (_row, state) => this._setProcessor(CDSP_PATH, state));

        // ── Separator ─────────────────────────────────────────────────────
        const sep = new St.Widget({
            style: 'height: 1px; background-color: rgba(255,255,255,0.12); margin: 4px 16px;',
            x_expand: true,
        });
        this.add_child(sep);

        // ── Footer link ("Extension Settings") (TODO)───────────────────────────
        const footer = new St.Button({
            label: 'Settings',
            style: [
               'padding: 10px 16px;',
                'font-size: 13px;',
                'color: rgba(255,255,255,0.60);',
                'text-align: left;',
            ].join(''),
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        footer.connect('notify::hover', () => {
            footer.style = [
                'padding: 10px 16px;',
                'font-size: 13px;',
                'text-align: left;',
                footer.hover
                    ? 'color: rgba(255,255,255,0.90);'
                    : 'color: rgba(255,255,255,0.60);',
            ].join('');
        });
        footer.connect('clicked', () => {
            toggle._extension.openPreferences?.();
        });
        this.add_child(footer);
    }

    // ── State helpers ─────────────────────────────────────────────────────

    updateStatus() {
        const adspState = readFile(`${ADSP_PATH}/state`) ?? 'offline';
        const cdspState = readFile(`${CDSP_PATH}/state`) ?? 'offline';
        const adspFw    = readFile(`${ADSP_PATH}/firmware`) ?? 'unknown';
        const cdspFw    = readFile(`${CDSP_PATH}/firmware`) ?? 'unknown';

        this._adspRow.setActive(adspState === 'running');
        this._cdspRow.setActive(cdspState === 'running');

        this._adspRow.setSubtitle(`${adspState}  ·  ${adspFw.split('/').pop()}`);
        this._cdspRow.setSubtitle(`${cdspState}  ·  ${cdspFw.split('/').pop()}`);

        // Mirror overall state back to the panel toggle
        const anyRunning = adspState === 'running' || cdspState === 'running';
        this._toggle.checked = anyRunning;
        this._toggle.subtitle = anyRunning ? 'Running' : 'Stopped';
    }

    _setProcessor(basePath, enable) {
        const target = enable ? 'start' : 'stop';
        const cmd = `pkexec sh -c "echo ${target} > ${basePath}/state"`;
        try {
            GLib.spawn_command_line_async(cmd);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 900, () => {
                this.updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            console.error('Remoteproc: Unable to change state', e);
        }
    }
});

// ── The QuickMenuToggle that lives in the panel ───────────────────────────────

const RemoteprocToggle = GObject.registerClass(
class RemoteprocToggle extends QuickSettings.QuickMenuToggle {
    _init(extension) {
        super._init({
            title: 'Remote Proc.',
            iconName: 'drive-harddisk-solidstate-symbolic',
            toggleMode: true,
        });

        this._extension = extension;

        // Build the custom menu content
        this._section = new RemoteprocMenuSection(this);
        this.menu.box.add_child(this._section);

        // "Toggle all" when clicking the panel icon itself
        this.connect('clicked', () => this._toggleAll());

        // Initial status (delayed slightly so Shell is fully ready)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
            this._section.updateStatus();
            return GLib.SOURCE_REMOVE;
        });

        // Periodic refresh every 5 s
        this._refreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            this._section.updateStatus();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _toggleAll() {
        // After click, this.checked is the NEW desired state
        const target = this.checked ? 'start' : 'stop';
        const cmd = `pkexec sh -c "echo ${target} > ${ADSP_PATH}/state && echo ${target} > ${CDSP_PATH}/state"`;
        try {
            GLib.spawn_command_line_async(cmd);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 900, () => {
                this._section.updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            console.error('Remoteproc: All processors are unable to change', e);
        }
    }

    destroy() {
        if (this._refreshId) {
            GLib.source_remove(this._refreshId);
            this._refreshId = 0;
        }
        super.destroy();
    }
});

// ── SystemIndicator wrapper (required by GNOME 45+) ───────────────────────────

const RemoteprocIndicator = GObject.registerClass(
class RemoteprocIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();
        this._toggle = new RemoteprocToggle(extension);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});

// ── Extension entry point ─────────────────────────────────────────────────────

export default class RemoteprocExtension extends ExtensionModule.Extension {
    enable() {
        this._indicator = new RemoteprocIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.get_parent()?.remove_child(this._indicator);
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
