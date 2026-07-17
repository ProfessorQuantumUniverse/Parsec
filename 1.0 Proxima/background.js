chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("newtab.html");
  await chrome.tabs.create({ url, active: true });
});
