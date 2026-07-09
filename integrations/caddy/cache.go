package acmehub

import (
	"crypto/tls"
	"sync"
	"time"
)

type cacheEntry struct {
	cert      *tls.Certificate
	expiresAt time.Time
}

type certCache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
}

func newCertCache() *certCache {
	return &certCache{entries: make(map[string]*cacheEntry)}
}

func (c *certCache) Get(domain string) (*tls.Certificate, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.entries[domain]
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.cert, true
}

func (c *certCache) Set(domain string, cert *tls.Certificate, maxAge time.Duration) {
	if maxAge <= 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[domain] = &cacheEntry{
		cert:      cert,
		expiresAt: time.Now().Add(maxAge),
	}
}
