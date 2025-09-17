/**
 * Lightweight client for fetching bead distribution p-values with
 * in-flight de-duplication and result caching.
 */

const cache = new Map();
const inFlight = new Map();

/**
 * Create a stable string representation of a value for caching purposes
 * @param {any} value - The value to stringify
 * @returns {string} Stable string representation
 */
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

/**
 * Fetch bead distribution p-values with caching and de-duplication
 * @param {Object} payload - Request payload for the API
 * @returns {Promise<Object>} Promise resolving to the API response data
 */
export async function getBeadDistributionPValues(payload) {
    const key = stableStringify(payload);

    if (cache.has(key)) {
        return cache.get(key);
    }
    if (inFlight.has(key)) {
        return inFlight.get(key);
    }

    const requestPromise = fetch('/api/getBeadDistributionPValues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        })
        .then(data => {
            cache.set(key, data);
            return data;
        })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, requestPromise);
    return requestPromise;
}

/**
 * Clear the p-values cache
 */
export function invalidatePValuesCache() {
    cache.clear();
}


