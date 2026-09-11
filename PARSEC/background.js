/* The toolbar button opens popup.html (quick-add for the page you are on),
 * so there is no onClicked handler to register. All this worker does is say
 * hello once, the first time the extension is installed. */

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html"), active: true });
});
