chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete' && tab.url) {
		const url = new URL(tab.url)
		const hostname = url.hostname
		if (!hostname.includes('.')) {
			chrome.action.setBadgeText({ tabId, text: '' })
			return
		}
		fetch(
			`https://cloudflare-dns.com/dns-query?name=${hostname}&type=AAAA`,
			{ headers: { 'Accept': 'application/dns-json' } }
		).then((response) => response.json())
			.then((data) => {
				if (data.Answer && data.Answer.some((record) => record.type === 28)) {
					chrome.action.setBadgeBackgroundColor({ tabId, color: 'green' })
					chrome.action.setBadgeText({ tabId, text: 'v6' })
				} else {
					chrome.action.setBadgeBackgroundColor({ tabId, color: 'red' })
					chrome.action.setBadgeText({ tabId, text: 'v4' })
				}
			})
	}
})
