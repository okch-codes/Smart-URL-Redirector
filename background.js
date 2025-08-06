// Background script for URL redirector
let currentRules = [];

// Function to update declarative rules
async function updateRedirectRules(rules) {
  // Remove all existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIdsToRemove = existingRules.map((rule) => rule.id);

  if (ruleIdsToRemove.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
    });
  }

  // Add new rules
  const newRules = rules.map((rule, index) => {
    const declarativeRule = {
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
      },
      condition: {
        resourceTypes: ["main_frame", "sub_frame"],
      },
    };

    // Handle pattern matching for URL preservation
    if (rule.from.includes('*')) {
      // If rule already contains wildcards, use as-is
      declarativeRule.condition.urlFilter = rule.from;
      declarativeRule.action.redirect = { url: rule.to };
    } else {
      // Convert prefix rules to wildcard patterns for path preservation
      // Check if this looks like a prefix rule that should preserve the rest of the URL
      const isLikelyPrefix = !rule.from.includes('?') && 
                           !rule.from.includes('#') &&
                           !rule.from.match(/\.[a-zA-Z0-9]+$/) &&
                           (rule.from.endsWith('/') || !rule.from.includes('/', rule.from.indexOf('://') + 3));
      
      // For your specific case: https://www.google.com/search should be treated as a prefix
      // This happens when the URL ends with a path segment without a trailing slash
      const endsWithPathSegment = rule.from.match(/\/[^\/]+$/) && !rule.from.includes('.');
      
      if (isLikelyPrefix || endsWithPathSegment) {
        // Use regexFilter with regexSubstitution to preserve the captured part
        const escapedFrom = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        declarativeRule.condition.regexFilter = '^' + escapedFrom + '(.*)$';
        
        // Use regexSubstitution to preserve the captured part
        declarativeRule.action.redirect = {
          regexSubstitution: rule.to + '\\1'
        };
        
        console.log(`Creating prefix rule: ${rule.from} -> ${rule.to} (regex: ${declarativeRule.condition.regexFilter})`);
      } else {
        // Exact match for specific URLs
        declarativeRule.condition.urlFilter = rule.from;
        declarativeRule.action.redirect = { url: rule.to };
        console.log(`Creating exact rule: ${rule.from} -> ${rule.to}`);
      }
    }

    return declarativeRule;
  });

  if (newRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: newRules,
    });
  }
}

// Function to load rules from storage and update redirect rules
async function loadAndApplyRules() {
  try {
    const data = await chrome.storage.sync.get({ rules: [] });
    currentRules = data.rules || [];
    await updateRedirectRules(currentRules);
    console.log("Redirect rules updated:", currentRules);
  } catch (error) {
    console.error("Error loading/applying rules:", error);
  }
}

// Listen for storage changes to update rules in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.rules) {
    loadAndApplyRules();
  }
});

// Initialize rules when extension starts
chrome.runtime.onStartup.addListener(() => {
  loadAndApplyRules();
});

// Also initialize on install/enable
chrome.runtime.onInstalled.addListener(() => {
  loadAndApplyRules();
});

// Load rules immediately when script loads
loadAndApplyRules();

// Add a listener for tab updates to catch URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when URL changes and page is loading/complete
  if (changeInfo.url && currentRules.length > 0) {
    console.log(`Tab ${tabId} URL changed to: ${changeInfo.url}`);
    
    // The content script will handle the actual redirection
    // This is just for logging/debugging
    for (const rule of currentRules) {
      if (changeInfo.url.startsWith(rule.from)) {
        console.log(`Potential redirect rule match: ${rule.from} -> ${rule.to}`);
        break;
      }
    }
  }
});
