/**
 * Scoped stylesheet for the auth surfaces. Uses the dsh --dsw-alias-* token
 * families with neutral fallbacks, and is injected/removed by the plugin
 * effect so HMR and unload leave no residue.
 */
export const STYLE_ID = 'dsh-auth-style'

export const CSS = `
[data-dsh-auth-trigger] {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #e6e9ef);
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  cursor: pointer;
  overflow: hidden;
}
[data-dsh-auth-trigger]:hover {
  background: var(--dsw-alias-interactive-bg-hover-solid, rgba(127,127,127,.16));
}
[data-dsh-auth-trigger]:disabled {
  opacity: .6;
  cursor: default;
}
[data-dsh-auth-trigger-label] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-dsh-auth-trigger].dsh-auth-rail {
  width: 36px;
  padding: 0;
  border-radius: 50%;
  justify-content: center;
}
[data-dsh-auth-tabs] {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
  padding: 2px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.06));
}
[data-dsh-auth-tab] {
  flex: 1;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #8b93a1);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
[data-dsh-auth-tab][data-active] {
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #1a1d23);
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
}
[data-dsh-auth-field] {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-dsh-auth-field-label] {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, #8b93a1);
}
[data-dsh-auth-error] {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-danger, rgba(228,72,72,.12));
  color: var(--dsw-alias-label-danger, #e04a4a);
  font-size: 12px;
  line-height: 18px;
}
[data-dsh-auth-notice] {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-success, rgba(48,164,108,.12));
  color: var(--dsw-alias-label-success, #2ea36c);
  font-size: 12px;
  line-height: 18px;
}
[data-dsh-auth-profile] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0 4px;
  text-align: center;
}
[data-dsh-auth-profile-avatar] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--dsw-alias-interactive-bg-hover, rgba(91,141,239,.16));
  color: var(--dsw-alias-label-primary, #1a1d23);
}
[data-dsh-auth-profile-name] {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 520;
  color: var(--dsw-alias-label-primary, #1a1d23);
}
[data-dsh-auth-profile-user] {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #9aa1ad);
}
[data-dsh-auth-spacer] {
  flex: 1;
}
[data-dsh-auth-settings] {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.14));
}
[data-dsh-auth-settings-head] {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
[data-dsh-auth-settings-title] {
  color: var(--dsw-alias-label-primary, #e6e9ef);
  font-size: 14px;
  line-height: 22px;
}
[data-dsh-auth-settings-label] {
  color: var(--dsw-alias-label-primary, #e6e9ef);
  font-size: 13px;
  line-height: 20px;
}
[data-dsh-auth-settings-desc] {
  color: var(--dsw-alias-label-tertiary, #9aa1ad);
  font-size: 12px;
  line-height: 18px;
}
[data-dsh-auth-settings-actions] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
[data-dsh-auth-settings-login] {
  flex: none;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-inverted, rgba(255,255,255,.14));
  border-radius: 16px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #e6e9ef);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
[data-dsh-auth-settings-login]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.16));
}
[data-dsh-auth-registration] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
[data-dsh-auth-registration-toggle] {
  flex: none;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 14px;
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.22));
  color: var(--dsw-alias-label-secondary, #8b93a1);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
[data-dsh-auth-registration-toggle][data-open] {
  background: var(--dsw-alias-button-primary-bg, #2e7cf6);
  color: var(--dsw-alias-button-primary-fg, #ffffff);
}
[data-dsh-auth-registration-toggle]:disabled {
  opacity: .6;
  cursor: default;
}
[data-dsh-auth-users-head] {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
[data-dsh-auth-refresh] {
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #8b93a1);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
[data-dsh-auth-refresh]:hover {
  color: var(--dsw-alias-label-primary, #e6e9ef);
}
[data-dsh-auth-users] {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
[data-dsh-auth-user] {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.05));
}
[data-dsh-auth-user-name] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary, #e6e9ef);
  font-size: 13px;
}
[data-dsh-auth-user-id] {
  margin-left: 6px;
  color: var(--dsw-alias-label-tertiary, #9aa1ad);
  font-size: 12px;
}
[data-dsh-auth-user-role] {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(91,141,239,.16));
  color: var(--dsw-alias-label-secondary, #8b93a1);
  font-size: 11px;
}
[data-dsh-auth-user-delete] {
  flex: none;
  margin-left: auto;
  border: none;
  border-radius: 8px;
  padding: 4px 10px;
  background: transparent;
  color: var(--dsw-alias-label-danger, #e04a4a);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
[data-dsh-auth-user-delete]:hover {
  background: var(--dsw-alias-bg-danger, rgba(228,72,72,.12));
}
[data-dsh-auth-user-delete]:disabled {
  opacity: .6;
  cursor: default;
}
`
