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
`
