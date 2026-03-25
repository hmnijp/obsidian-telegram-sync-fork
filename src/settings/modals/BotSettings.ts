import { Modal, Setting } from "obsidian";
import TelegramSyncPlugin from "src/main";
import { _5sec, displayAndLog } from "src/utils/logUtils";
import { PinCodeModal } from "./PinCode";
import { ProxyProtocol } from "src/telegram/user/client";

export const mainDeviceIdSettingName = "Main device id";

export class BotSettingsModal extends Modal {
	botSettingsDiv: HTMLDivElement;
	saved = false;
	constructor(public plugin: TelegramSyncPlugin) {
		super(plugin.app);
	}

	async display() {
		this.addHeader();
		this.addBotToken();
		this.addAllowedChatsSetting();
		this.addDeviceId();
		this.addEncryptionByPinCode();
		this.addProxySettings();
		this.addFooterButtons();
	}

	addHeader() {
		this.contentEl.empty();
		this.botSettingsDiv = this.contentEl.createDiv();
		this.titleEl.setText("Bot settings");
		const limitations = new Setting(this.botSettingsDiv).setDesc("⚠ Limitations of Telegram bot:");
		const lim24Hours = document.createElement("div");
		lim24Hours.setText("- It can get only messages sent within the last 24 hours");
		lim24Hours.style.marginLeft = "10px";
		const limBlocks = document.createElement("div");
		limBlocks.style.marginLeft = "10px";
		limBlocks.setText("- Use VPN or proxy to bypass blocks in China, Iran, and limited corporate networks ");
		limBlocks.createEl("a", {
			href: "https://github.com/soberhacker/obsidian-telegram-sync/issues/225#issuecomment-1780539957",
			text: "([ex. config of Clash],",
		});
		limBlocks.createEl("a", {
			href: "https://github.com/windingblack/obsidian-global-proxy",
			text: " [Obsidian Global Proxy])",
		});
		limitations.descEl.appendChild(lim24Hours);
		limitations.descEl.appendChild(limBlocks);
	}

	addBotToken() {
		new Setting(this.botSettingsDiv)
			.setName("Bot token (required)")
			.setDesc("Enter your Telegram bot token.")
			.addText(async (text) => {
				text.setPlaceholder("example: 6123456784:AAX9mXnFE2q9WahQ")
					.setValue(await this.plugin.getBotToken())
					.onChange(async (value: string) => {
						if (!value) {
							text.inputEl.style.borderColor = "red";
							text.inputEl.style.borderWidth = "2px";
							text.inputEl.style.borderStyle = "solid";
						}
						this.plugin.settings.botToken = value;
						this.plugin.settings.botTokenEncrypted = false;
					});
			});
	}

	addAllowedChatsSetting() {
		const allowedChatsSetting = new Setting(this.botSettingsDiv)
			.setName("Allowed chats (required)")
			.setDesc(
				"Enter list of usernames or chat ids that should be processed. At least your username must be entered.",
			)
			.addTextArea((text) => {
				const textArea = text
					.setPlaceholder("example: soberhacker,1227636")
					.setValue(this.plugin.settings.allowedChats.join(", "))
					.onChange(async (value: string) => {
						value = value.replace(/\s/g, "");
						if (!value) {
							textArea.inputEl.style.borderColor = "red";
							textArea.inputEl.style.borderWidth = "2px";
							textArea.inputEl.style.borderStyle = "solid";
						}
						this.plugin.settings.allowedChats = value.split(",");
					});
			});
		// add link to Telegram FAQ about getting username
		const howDoIGetUsername = document.createElement("div");
		howDoIGetUsername.textContent = "To get help click on -> ";
		howDoIGetUsername.createEl("a", {
			href: "https://telegram.org/faq?setln=en#q-what-are-usernames-how-do-i-get-one",
			text: "Telegram FAQ",
		});
		allowedChatsSetting.descEl.appendChild(howDoIGetUsername);
	}

	addDeviceId() {
		const deviceIdSetting = new Setting(this.botSettingsDiv)
			.setName(mainDeviceIdSettingName)
			.setDesc(
				"Specify the device to be used for sync when running Obsidian simultaneously on multiple desktops. If not specified, the priority will shift unpredictably.",
			)
			.addText((text) =>
				text
					.setPlaceholder("example: 98912984-c4e9-5ceb-8000-03882a0485e4")
					.setValue(this.plugin.settings.mainDeviceId)
					.onChange((value) => (this.plugin.settings.mainDeviceId = value)),
			);

		// current device id copy to settings
		const deviceIdLink = deviceIdSetting.descEl.createDiv();
		deviceIdLink.textContent = "To make the current device as main, click on -> ";
		deviceIdLink
			.createEl("a", {
				href: this.plugin.currentDeviceId,
				text: this.plugin.currentDeviceId,
			})
			.onClickEvent((evt) => {
				evt.preventDefault();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let inputDeviceId: any;
				try {
					inputDeviceId = deviceIdSetting.controlEl.firstElementChild;
					inputDeviceId.value = this.plugin.currentDeviceId;
				} catch (error) {
					displayAndLog(this.plugin, `Try to copy and paste device id manually. Error: ${error}`, _5sec);
				}
				if (inputDeviceId && inputDeviceId.value)
					this.plugin.settings.mainDeviceId = this.plugin.currentDeviceId;
			});
	}

	addEncryptionByPinCode() {
		const botTokenSetting = new Setting(this.botSettingsDiv)
			.setName("Bot token encryption using a PIN code")
			.setDesc(
				"Encrypt the bot token for enhanced security. When enabled, a PIN code is required at each Obsidian launch. ",
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.encryptionByPinCode);
				toggle.onChange(async (value) => {
					if (this.plugin.settings.botTokenEncrypted) {
						this.plugin.settings.botToken = await this.plugin.getBotToken();
						this.plugin.settings.botTokenEncrypted = false;
					}
					this.plugin.settings.encryptionByPinCode = value;
					if (!value) {
						this.plugin.pinCode = undefined;
						return;
					}
					const pinCodeModal = new PinCodeModal(this.plugin, false);
					pinCodeModal.onClose = async () => {
						if (pinCodeModal.saved && this.plugin.pinCode) return;
						this.plugin.settings.encryptionByPinCode = false;
					};
					pinCodeModal.open();
				});
			});
		botTokenSetting.descEl.createEl("a", {
			href: "https://github.com/soberhacker/obsidian-telegram-sync/blob/main/docs/Bot%20Token%20Encryption.md",
			text: "What does this can prevent?",
		});
	}

	addProxySettings() {
		const proxy = this.plugin.settings.proxySettings;

		const proxyHeader = new Setting(this.botSettingsDiv).setName("Proxy").setHeading();
		proxyHeader.setDesc("Configure a proxy for Telegram connections. SOCKS4/5 applies to both bot and user connections. HTTP/HTTPS applies to bot only.");

		new Setting(this.botSettingsDiv)
			.setName("Enable proxy")
			.addToggle((toggle) => {
				toggle.setValue(proxy.enabled).onChange((value) => {
					proxy.enabled = value;
					this.display();
				});
			});

		if (!proxy.enabled) return;

		new Setting(this.botSettingsDiv)
			.setName("Protocol")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({ http: "HTTP", https: "HTTPS", socks5: "SOCKS5", socks4: "SOCKS4" } as Record<ProxyProtocol, string>)
					.setValue(proxy.protocol)
					.onChange((value) => {
						proxy.protocol = value as ProxyProtocol;
					});
			});

		new Setting(this.botSettingsDiv)
			.setName("Host")
			.setDesc("Proxy server hostname or IP address.")
			.addText((text) =>
				text
					.setPlaceholder("example: 127.0.0.1")
					.setValue(proxy.host)
					.onChange((value) => {
						proxy.host = value.trim();
					}),
			);

		new Setting(this.botSettingsDiv)
			.setName("Port")
			.addText((text) =>
				text
					.setPlaceholder("example: 1080")
					.setValue(proxy.port ? String(proxy.port) : "")
					.onChange((value) => {
						const parsed = parseInt(value, 10);
						proxy.port = isNaN(parsed) ? 0 : parsed;
					}),
			);

		new Setting(this.botSettingsDiv)
			.setName("Username")
			.setDesc("Optional. Leave blank if the proxy requires no authentication.")
			.addText((text) =>
				text
					.setPlaceholder("username")
					.setValue(proxy.username)
					.onChange((value) => {
						proxy.username = value;
					}),
			);

		new Setting(this.botSettingsDiv)
			.setName("Password")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("password")
					.setValue(proxy.password)
					.onChange((value) => {
						proxy.password = value;
					});
			});
	}

	addFooterButtons() {
		this.botSettingsDiv.createEl("br");
		const footerButtons = new Setting(this.contentEl.createDiv());
		footerButtons.addButton((b) => {
			b.setTooltip("Connect")
				.setIcon("checkmark")
				.onClick(async () => {
					if (!this.plugin.settings.botTokenEncrypted) this.plugin.botTokenEncrypt();
					await this.plugin.saveSettings();
					this.saved = true;
					this.close();
				});
			return b;
		});
		footerButtons.addExtraButton((b) => {
			b.setIcon("cross")
				.setTooltip("Cancel")
				.onClick(async () => {
					await this.plugin.loadSettings();
					this.saved = false;
					this.close();
				});
			return b;
		});
	}

	onOpen() {
		this.display();
	}
}
