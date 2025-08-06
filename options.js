// Options page logic
function renderRules(rules) {
  const tbody = document.querySelector('#rulesTable tbody');
  const noRulesDiv = document.getElementById('noRules');
  const table = document.getElementById('rulesTable');
  
  tbody.innerHTML = '';
  
  if (rules.length === 0) {
    table.style.display = 'none';
    noRulesDiv.style.display = 'block';
    return;
  }
  
  table.style.display = 'table';
  noRulesDiv.style.display = 'none';
  
  rules.forEach((rule, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace;">${escapeHtml(rule.from)}</td>
      <td style="font-family: monospace;">${escapeHtml(rule.to)}</td>
      <td><button class="remove-btn" data-idx="${idx}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function loadRules() {
  chrome.storage.sync.get({ rules: [] }, function(data) {
    renderRules(data.rules || []);
  });
}

function validateUrl(url) {
  // Allow URL patterns with wildcards or valid URLs
  if (url.includes('*')) {
    return true; // Allow wildcard patterns
  }
  try {
    new URL(url);
    return true;
  } catch {
    // Check if it looks like a domain pattern
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(url);
  }
}

function showMessage(text, isError = false) {
  // Remove existing messages
  const existingMsg = document.querySelector('.message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  const msg = document.createElement('div');
  msg.className = 'message';
  msg.textContent = text;
  msg.style.cssText = `
    padding: 10px;
    margin: 10px 0;
    border-radius: 4px;
    ${isError ? 'background: #ffebee; color: #c62828; border: 1px solid #ef5350;' : 'background: #e8f5e8; color: #2e7d32; border: 1px solid #4caf50;'}
  `;
  
  document.querySelector('form').insertAdjacentElement('afterend', msg);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (msg.parentNode) {
      msg.remove();
    }
  }, 3000);
}

document.getElementById('addRuleForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const from = document.getElementById('from').value.trim();
  const to = document.getElementById('to').value.trim();
  
  if (!from || !to) {
    showMessage('Please fill in both fields.', true);
    return;
  }
  
  if (!validateUrl(to) && !to.includes('*')) {
    showMessage('Please enter a valid destination URL.', true);
    return;
  }
  
  chrome.storage.sync.get({ rules: [] }, function(data) {
    const rules = data.rules || [];
    
    // Check for duplicate rules
    const duplicate = rules.find(rule => rule.from === from);
    if (duplicate) {
      showMessage('A rule with this pattern already exists.', true);
      return;
    }
    
    rules.push({ from, to });
    chrome.storage.sync.set({ rules }, function() {
      if (chrome.runtime.lastError) {
        showMessage('Error saving rule: ' + chrome.runtime.lastError.message, true);
      } else {
        showMessage('Rule added successfully!');
        loadRules();
        e.target.reset();
      }
    });
  });
});

document.querySelector('#rulesTable tbody').addEventListener('click', function(e) {
  if (e.target.classList.contains('remove-btn')) {
    const idx = parseInt(e.target.getAttribute('data-idx'));
    
    if (confirm('Are you sure you want to remove this rule?')) {
      chrome.storage.sync.get({ rules: [] }, function(data) {
        const rules = data.rules || [];
        rules.splice(idx, 1);
        chrome.storage.sync.set({ rules }, function() {
          if (chrome.runtime.lastError) {
            showMessage('Error removing rule: ' + chrome.runtime.lastError.message, true);
          } else {
            showMessage('Rule removed successfully!');
            loadRules();
          }
        });
      });
    }
  }
});

// Load rules when page loads
document.addEventListener('DOMContentLoaded', loadRules);
