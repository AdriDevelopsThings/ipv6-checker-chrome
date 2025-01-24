const TLD_BLACKLIST = ['local', 'onion']
const cache = {}

async function getIPv6SupportByHostname(hostname) {
	// an ipv6 address itself obviously supports ipv6
	if (hostname.match(/^\[[0-9a-f\:\.]*\]$/g)) {
		// TODO: implement ::ffff:0:0/96 addresses

		return 'SUPPORTED'
	}
	
	// an ipv4 address obviously doesn't support ipv6
	if (hostname.match(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/g)) {
		// this assumes the browser automatically reformats ipv4 addresses into the typical octet notation
		// unfortunately ipv4 addresses could have any format (e.g. 2130706433 or 0x7f000001 are valid ipv4 addresses)

		return 'UNSUPPORTED'
	}
	
	const zones = hostname.split('.').filter(zone => zone !== '') // filter out root zone if needed

	if (
		zones.length === 1 || // a / aaaa records on tlds are very rare, so we just assume there aren't any
		TLD_BLACKLIST.includes(zones[zones.length - 1])
	) {
		return 'UNKNOWN'
	}

	const response = await fetch(
		`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=AAAA`,
		{ headers: { 'Accept': 'application/dns-json' } }
	)
	const data = await response.json()

	const hasAAAARecord = Boolean(data.Answer?.some(record => record.type === 28))

	return hasAAAARecord ? 'SUPPORTED' : 'UNSUPPORTED'
}

async function doCachedIPv6SupportLookup(hostname) {
	if (!cache[hostname] || cache[hostname].expires < Date.now()) {
		const state = await getIPv6SupportByHostname(hostname)
		const expires = Date.now() + (1000 * 60 * 2) // 2 min cache lifetime

		cache[hostname] = { state, expires }
	}

	return cache[hostname].state
}

function updateBadge(tabId, text, color) {
	if (!text) {
		chrome.action.setBadgeText({ tabId, text: '' })
		return
	}

	chrome.action.setBadgeText({ tabId, text })
	if (color) {
		chrome.action.setBadgeBackgroundColor({ tabId, color })
	}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete' && tab.url) {
		const { hostname } = new URL(tab.url)
		const hostnameLowercase = hostname.toLowerCase()

		doCachedIPv6SupportLookup(hostnameLowercase).then(supportStatus => {
			switch (supportStatus) {
				case 'SUPPORTED':
					updateBadge(tabId, 'v6', 'green')
					break

				case 'UNSUPPORTED':
					updateBadge(tabId, 'v4', 'red')
					break

				case 'UNKNOWN':
					updateBadge(tabId, null, null)
					break
			}
		})
	}
})
