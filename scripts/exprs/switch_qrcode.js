(() => {
  // 贝壳登录弹窗常见结构：手机登录 / 扫码登录切换，找含"扫码"字样的元素点击
  const el = Array.from(document.querySelectorAll('span, a, div, li')).find(e => e.textContent.includes('扫码登录') && e.offsetParent !== null);
  if (el) { el.click(); return 'CLICKED_QRCODE_TAB: ' + el.textContent.trim(); }
  // 备选：找 class 含 qrcode 或 qr-code 的tab
  const tab = document.querySelector('[class*="qrcode"], [class*="qr-code"], [data-type*="qr"]');
  if (tab) { tab.click(); return 'CLICKED_QRCODE_EL: ' + (tab.className || tab.tagName); }
  return 'QRCODE_TAB_NOT_FOUND';
})()
