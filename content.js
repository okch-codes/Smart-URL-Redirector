// Content script to monitor URL changes
let currentUrl = window.location.href;
let rules = [];

// Load rules from storage
chrome.storage.sync.get({ rules: [] }).then((data) => {
  rules = data.rules || [];
});

// Listen for rule updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.rules) {
    rules = changes.rules.newValue || [];
  }
});

// Function to check and apply redirect rules
function checkAndRedirect(url) {
  for (const rule of rules) {
    let shouldRedirect = false;
    let redirectUrl = rule.to;

    if (rule.from.includes('*')) {
      // Handle wildcard patterns
      const pattern = rule.from.replace(/\*/g, '.*');
      const regex = new RegExp('^' + pattern + '$');
      if (regex.test(url)) {
        shouldRedirect = true;
        // For wildcard rules, use the rule.to as-is
      }
    } else {
      // Check for prefix matching
      const isLikelyPrefix = !rule.from.includes('?') && 
                           !rule.from.includes('#') &&
                           !rule.from.match(/\.[a-zA-Z0-9]+$/) &&
                           (rule.from.endsWith('/') || !rule.from.includes('/', rule.from.indexOf('://') + 3));
      
      const endsWithPathSegment = rule.from.match(/\/[^\/]+$/) && !rule.from.includes('.');
      
      if (isLikelyPrefix || endsWithPathSegment) {
        // Prefix matching - preserve the rest of the URL
        if (url.startsWith(rule.from) || url === rule.from) {
          shouldRedirect = true;
          const remainingPath = url.substring(rule.from.length);
          redirectUrl = rule.to + remainingPath;
        }
      } else {
        // Exact match
        if (url === rule.from) {
          shouldRedirect = true;
        }
      }
    }

    if (shouldRedirect) {
      console.log(`Redirecting from ${url} to ${redirectUrl}`);
      window.location.href = redirectUrl;
      return true;
    }
  }
  return false;
}

// Check current URL on load
checkAndRedirect(currentUrl);

// Monitor URL changes using multiple methods
function onUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log(`URL changed from ${currentUrl} to ${newUrl}`);
    currentUrl = newUrl;
    checkAndRedirect(newUrl);
  }
}

// Method 1: Monitor history API changes
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  setTimeout(onUrlChange, 0);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  setTimeout(onUrlChange, 0);
};

// Method 2: Listen for popstate events
window.addEventListener('popstate', onUrlChange);

// Method 3: Periodic URL checking as fallback
setInterval(onUrlChange, 500);

// Method 4: Listen for focus events (when user returns to tab)
window.addEventListener('focus', onUrlChange);
