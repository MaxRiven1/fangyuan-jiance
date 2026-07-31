(() => {
  const cands = Array.from(document.querySelectorAll('a,span,div,button')).filter(e => e.textContent.trim().replace(/\s+/g,'') .match(/^登录\/?注?册?$|^登录$/) && e.offsetParent !== null);
  if (cands.length) { cands[0].click(); return 'CLICKED: ' + cands[0].textContent.trim().replace(/\s+/g,''); }
  const a = document.querySelector('a[href*="login"]');
  if (a) { a.click(); return 'CLICKED_HREF'; }
  return 'NOT_FOUND';
})()
