chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'apply-assistant:open-panel' || sender.id !== chrome.runtime.id || !sender.tab?.id || sender.frameId !== 0) return;
  // Call immediately while the content-script click still carries a user gesture.
  chrome.sidePanel.open({ tabId: sender.tab.id }).then(
    () => respond({ ok: true }),
    () => respond({ ok: false })
  );
  return true;
});
